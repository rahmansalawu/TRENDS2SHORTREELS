import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Sparkles, TrendingUp, RefreshCw, XCircle, Download, LayoutTemplate, Users, Mic } from 'lucide-react';

const TARGET_AUDIENCES = [
  "General Audience",
  "Gen Z / TikTok",
  "Professionals / LinkedIn",
  "Kids & Teens"
];

const VIDEO_TEMPLATES = [
  {
     id: 'cinematic',
     label: 'Cinematic',
     transition: 'transition-all duration-1000 ease-in-out',
     activeImg: 'opacity-60 scale-100',
     inactiveImg: 'opacity-0 scale-110 blur-sm',
     textContainer: 'absolute bottom-12 left-6 right-6 z-20 flex justify-center',
     textStyle: 'text-white font-serif italic text-[1.6rem] text-center [text-shadow:2px_2px_4px_rgba(0,0,0,0.8)]',
  },
  {
     id: 'creator',
     label: 'Creator Tech',
     transition: 'transition-transform duration-200 ease-out',
     activeImg: 'translate-x-0 opacity-80',
     inactiveImg: 'translate-x-[10%] opacity-0',
     textContainer: 'absolute bottom-20 left-4 right-4 z-20 flex justify-center',
     textStyle: 'text-black bg-[#CDFF00] font-black text-[1.8rem] uppercase px-3 py-1 shadow-[4px_4px_0px_#000] rotate-[-2deg]',
  },
  {
     id: 'news',
     label: 'Breaking News',
     transition: 'transition-opacity duration-300',
     activeImg: 'opacity-70',
     inactiveImg: 'opacity-0',
     textContainer: 'absolute bottom-0 left-0 right-0 z-20',
     textStyle: 'bg-red-600 text-white font-bold text-[1.2rem] px-4 py-3 uppercase border-t-4 border-yellow-400 w-full text-center',
  },
  {
     id: 'minimal',
     label: 'Minimalist',
     transition: 'transition-all duration-700 ease-in',
     activeImg: 'opacity-50 grayscale',
     inactiveImg: 'opacity-0 grayscale blur-md',
     textContainer: 'absolute inset-0 flex items-center justify-center p-6 z-20',
     textStyle: 'text-white font-mono text-sm uppercase tracking-[0.3em] text-center bg-black/40 px-4 py-2 backdrop-blur-sm',
  }
];

// Audio Helper for raw PCM at 24000Hz (Gemini TTS default)
function encodePCMToWAV(pcmBase64: string, sampleRate = 24000): string {
  const rawStr = atob(pcmBase64);
  const pcmData = new Uint8Array(rawStr.length);
  for (let i = 0; i < rawStr.length; i++) {
    pcmData[i] = rawStr.charCodeAt(i);
  }
  
  const numChannels = 1;
  const blockAlign = numChannels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);
  
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

export default function App() {
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState<string>('');
  const [articles, setArticles] = useState<any[]>([]);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [availableImages, setAvailableImages] = useState<{url: string, index: number}[]>([]);
  const [selectedImageIndices, setSelectedImageIndices] = useState<Set<number>>(new Set());
  const [shortData, setShortData] = useState<any>(null);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);
  const [groundingLimitReached, setGroundingLimitReached] = useState<boolean>(false);
  const [audience, setAudience] = useState<string>('General Audience');
  const [template, setTemplate] = useState<string>('cinematic');

  // Multi-Speaker Voice Accents selectable details
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck'); 
  const [useAIGraphicSystem, setUseAIGraphicSystem] = useState<boolean>(true); // PREMIUM AI Images enabled by default

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    // Dynamically check configuration on startup and on load
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/check-config');
        if (res.ok) {
          const data = await res.json();
          setHasApiKey(data.hasApiKey);
        }
      } catch (err) {
        console.warn("Failed to check configuration status:", err);
      }
    };
    checkConfig();
  }, []);

  const renderVideo = async () => {
    if (!shortData || !canvasRef.current) return;
    
    try {
      setIsRendering(true);
      setRenderProgress(0);
      setIsPlaying(false);
      audioRef.current?.pause();

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");

      // Set dimensions to 720x1280 (vertical)
      canvas.width = 720;
      canvas.height = 1280;

      // Prepare Audio Context for recording
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      
      // Combine Canvas stream and Audio stream
      const canvasStream = canvas.captureStream(30); // 30 FPS
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ]);

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=h264') 
          ? 'video/webm;codecs=h264' 
          : 'video/webm'
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TrendToShorts_${topic.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_')}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRendering(false);
        setRenderProgress(0);
      };

      recorder.start();

      // Rendering Loop
      for (let i = 0; i < shortData.segments.length; i++) {
        const seg = shortData.segments[i];
        setCurrentSegment(i);
        setRenderProgress(((i) / shortData.segments.length) * 100);

        // 1. Load Image (route through high-performance CORS proxy destination to keep the canvas untainted)
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = seg.imageUrl.startsWith('data:') 
          ? seg.imageUrl 
          : `/api/proxy-image?url=${encodeURIComponent(seg.imageUrl)}`;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails
        });

        // 2. Play Audio & Draw Frames
        if (seg.audioUrl) {
           const audioRes = await fetch(seg.audioUrl);
           const audioData = await audioRes.arrayBuffer();
           const audioBuffer = await audioCtx.decodeAudioData(audioData);
           
           const source = audioCtx.createBufferSource();
           source.buffer = audioBuffer;
           source.connect(dest);
           source.connect(audioCtx.destination);
           
           const duration = audioBuffer.duration;
           source.start();

           // Animation Loop for this segment
           const startTime = audioCtx.currentTime;
           await new Promise<void>((resolve) => {
             const drawFrame = () => {
               const elapsed = audioCtx.currentTime - startTime;
               
               // Draw Background (black)
               ctx.fillStyle = '#000';
               ctx.fillRect(0, 0, canvas.width, canvas.height);

               // Premium Visual Sizing Strategy (CapCut Landscape Blur vs Ken Burns Portrait cover)
               if (img.complete && img.width > 0) {
                  const isLandscape = img.width > img.height;
                  
                  if (isLandscape) {
                     // CAPCUT STYLE BLUR FILL BACKGROUND
                     const bgScale = Math.max(canvas.width / img.width, canvas.height / img.height);
                     const bgW = img.width * bgScale;
                     const bgH = img.height * bgScale;
                     const bgX = (canvas.width - bgW) / 2;
                     const bgY = (canvas.height - bgH) / 2;
                     
                     ctx.save();
                     ctx.filter = 'blur(40px) brightness(0.55)';
                     ctx.drawImage(img, bgX, bgY, bgW, bgH);
                     ctx.restore();
                     
                     // CENTERED FIT FOREFRONT WITH DROP SHADOW
                     const fitScale = canvas.width / img.width;
                     const fitW = canvas.width;
                     const fitH = img.height * fitScale;
                     const fitX = 0;
                     const fitY = (canvas.height - fitH) / 2;
                     
                     ctx.save();
                     ctx.shadowColor = 'rgba(0,0,0,0.65)';
                     ctx.shadowBlur = 30;
                     ctx.drawImage(img, fitX, fitY, fitW, fitH);
                     ctx.restore();
                  } else {
                     // PORTRAIT IMAGE KEN BURNS ZOOM/FLOAT EFFECT
                     const progress = Math.min(1.0, elapsed / duration);
                     const zoomFactor = 1.0 + (progress * 0.12); // slow 12% scale magnification
                     const baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
                     const finalScale = baseScale * zoomFactor;
                     
                     const w = img.width * finalScale;
                     const h = img.height * finalScale;
                     const x = (canvas.width - w) / 2;
                     const yMin = (canvas.height - h) / 2;
                     const y = yMin + (progress * -20); // slow floating float upwards
                     
                     ctx.save();
                     ctx.globalAlpha = Math.min(1.0, elapsed * 2.0); // clean fade entrance
                     ctx.drawImage(img, x, y, w, h);
                     ctx.restore();
                  }

                  // Template specific overlays (soft bottom gradient instead of ruining contrast)
                  if (template === 'minimal') {
                     ctx.save();
                     ctx.fillStyle = 'rgba(0,0,0,0.15)';
                     ctx.fillRect(0, 0, canvas.width, canvas.height);
                     ctx.restore();
                  }
               }

               // World-Class legibility bottom soft gradient shadow (leaves top 70% of image completely pristine and bright!)
               ctx.save();
               const textGrad = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
               textGrad.addColorStop(0, 'rgba(0,0,0,0)');
               textGrad.addColorStop(0.3, 'rgba(0,0,0,0.3)');
               textGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
               ctx.fillStyle = textGrad;
               ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);
               ctx.restore();

               // Draw Overlay Text with High-End Viral Custom Styles
               if (seg.overlayText) {
                  ctx.save();
                  if (template === 'news') {
                     // Crisp Dynamic ticker headline bar
                     ctx.fillStyle = '#C20E1A'; // Premium Crimson News
                     ctx.fillRect(0, canvas.height - 230, canvas.width, 100);
                     ctx.strokeStyle = '#FFD700'; // Rich yellow metal
                     ctx.lineWidth = 8;
                     ctx.beginPath();
                     ctx.moveTo(0, canvas.height - 230);
                     ctx.lineTo(canvas.width, canvas.height - 230);
                     ctx.stroke();

                     ctx.fillStyle = 'white';
                     ctx.font = 'bold 38px Arial';
                     ctx.textAlign = 'center';
                     ctx.fillText(seg.overlayText.toUpperCase(), canvas.width / 2, canvas.height - 165);
                  } else if (template === 'creator') {
                     // TikTok/CapCut Volt Yellow Neon with heavy custom border outline stroke!
                     ctx.translate(canvas.width / 2, canvas.height - 220);
                     ctx.rotate(-2 * Math.PI / 180);
                     ctx.font = 'bold 50px Arial Black, Impact, sans-serif';
                     ctx.textAlign = 'center';
                     
                     // Stroke first
                     ctx.strokeStyle = 'black';
                     ctx.lineWidth = 14;
                     ctx.lineJoin = 'miter';
                     ctx.miterLimit = 2;
                     ctx.strokeText(seg.overlayText.toUpperCase(), 0, 0);
                     
                     // Fill
                     ctx.fillStyle = '#E3FF00'; // volt yellow
                     ctx.fillText(seg.overlayText.toUpperCase(), 0, 0);
                  } else if (template === 'cinematic') {
                     // Luxury high-end cinematic serif Look
                     ctx.fillStyle = 'white';
                     ctx.font = 'italic 44px Georgia, serif';
                     ctx.textAlign = 'center';
                     ctx.shadowColor = 'rgba(0,0,0,0.8)';
                     ctx.shadowBlur = 12;
                     ctx.fillText(seg.overlayText, canvas.width / 2, canvas.height - 180);
                  } else {
                     // Minimalist typewriter container block
                     ctx.translate(canvas.width / 2, canvas.height - 220);
                     ctx.font = '28px Courier New, monospace';
                     ctx.textAlign = 'center';
                     
                     const tw = ctx.measureText(seg.overlayText.toUpperCase()).width;
                     ctx.fillStyle = 'rgba(0,0,0,0.7)';
                     ctx.fillRect(-tw/2 - 30, -35, tw + 60, 60);

                     ctx.fillStyle = 'white';
                     ctx.fillText(seg.overlayText.toUpperCase(), 0, 5);
                  }
                  ctx.restore();
               }

               if (elapsed < duration) {
                 requestAnimationFrame(drawFrame);
               } else {
                 resolve();
               }
             };
             drawFrame();
           });
        }
      }

      setRenderProgress(100);
      recorder.stop();
      audioCtx.close();

    } catch (err) {
      console.error("Rendering failed:", err);
      setError("Rendering failed: " + String(err));
      setIsRendering(false);
    }
  };

  const downloadJSONData = () => {
     if (!shortData) return;
     const payload = {
        topic,
        audience,
        template,
        title: shortData.title,
        segments: shortData.segments.map((s: any) => ({
             narration: s.narration,
             overlayText: s.overlayText,
             imageUrl: s.imageUrl,
             audioAvailable: !!s.audioUrl,
             imageGenPrompt: s.imageGenPrompt
        }))
     };
     const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `TrendToShorts_${topic.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_')}.json`;
     a.click();
     URL.revokeObjectURL(url);
  };

  const fetchTrends = async () => {
    try {
      setShortData(null);
      setArticles([]);
      setTopic('');
      setTopics([]);
      setError(null);
      setIsPlaying(false);
      setAvailableImages([]);
      setSelectedImageIndices(new Set());
      setGroundingLimitReached(false);
      
      setLoadingStep('Fetching Google Trends...');
      const APP_URL = process.env.APP_URL || '';
      const apiUrl = APP_URL ? `${APP_URL}/api/trending` : '/api/trending';
      
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Failed to fetch trending topics.');
      const data = await res.json();
      setTopics(data.topics || []);
      setLoadingStep('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred.');
      setLoadingStep('');
    }
  };

  const fetchArticlesForTopic = async (selectedTopic: string) => {
    try {
      setTopic(selectedTopic);
      setShortData(null);
      setArticles([]);
      setError(null);
      setIsPlaying(false);
      setGroundingLimitReached(false);
      
      setLoadingStep(`Fetching News for ${selectedTopic}...`);
      const APP_URL = process.env.APP_URL || '';
      const apiUrl = APP_URL ? `${APP_URL}/api/trending?topic=${encodeURIComponent(selectedTopic)}` : `/api/trending?topic=${encodeURIComponent(selectedTopic)}`;
      
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('Failed to fetch news.');
      const data = await res.json();
      setGroundingLimitReached(!!data.limitNotice);
      const fetchedArticles = data.articles || [];
      setArticles(fetchedArticles);
      
      const imgs: {url: string, index: number}[] = [];
      let imgId = 0;
      for (const a of fetchedArticles) {
          if (a.images && Array.isArray(a.images)) {
              for (const u of a.images) {
                  imgs.push({url: u, index: imgId++});
              }
          } else if (a.imageUrl) {
              imgs.push({url: a.imageUrl, index: imgId++});
          }
      }
      setAvailableImages(imgs);
      setSelectedImageIndices(new Set(imgs.slice(0, 10).map((im) => im.index)));
      
      setLoadingStep('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred.');
      setLoadingStep('');
    }
  };

  const generateShorts = async () => {
    if (!topic || articles.length === 0) return;
    try {
      setError(null);
      setUsedFallback(false);
      setIsPlaying(false);
      setShortData(null);

      // Step 1: Request script structured segments
      setLoadingStep('Analyzing context and writing script...');
      const APP_URL = process.env.APP_URL || '';
      const scriptUrl = APP_URL ? `${APP_URL}/api/generate-script` : '/api/generate-script';
      
      const scriptRes = await fetch(scriptUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ topic, audience, articles })
      });

      if (!scriptRes.ok) {
         const errData = await scriptRes.json();
         throw new Error(errData.error || `Script Generator returned error ${scriptRes.status}`);
      }

      const scriptJson = await scriptRes.json();
      if (!scriptJson || !scriptJson.segments) {
         throw new Error('No segments returned in the script configuration.');
      }
      setUsedFallback(!!scriptJson._usedFallbackModel);

      // Step 2: Sequentially process voice synthesis and vertical art generation to avoid concurrency quotas (429)
      const userImages = availableImages.filter(im => selectedImageIndices.has(im.index));
      const finalizedSegments: any[] = [];

      for (let i = 0; i < scriptJson.segments.length; i++) {
         const seg = scriptJson.segments[i];
         const progressLabel = `(Scene ${i + 1} of ${scriptJson.segments.length})`;
         
         // 2a. Voice speech accent synthesis
         setLoadingStep(`Synthesizing narration speech ${progressLabel}...`);
         const ttsUrl = APP_URL ? `${APP_URL}/api/synthesize-tts` : '/api/synthesize-tts';
         
         const ttsRes = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: seg.narration, voice: selectedVoice })
         });

         let audioUrl = '';
         let base64Audio = '';
         if (ttsRes.ok) {
            const ttsJson = await ttsRes.json();
            base64Audio = ttsJson.base64Audio;
            audioUrl = encodePCMToWAV(ttsJson.base64Audio);
         } else {
             const ttsErr = await ttsRes.json();
             console.warn(`TTS voice generator failed for segment ${i + 1}:`, ttsErr);
         }

         // 2b. Visual asset pipeline: generate premium vertical image or map scraped graphics
         let imageUrl = '';
         if (useAIGraphicSystem) {
             setLoadingStep(`Creating custom AI graphics visual ${progressLabel}...`);
             const imgGenUrl = APP_URL ? `${APP_URL}/api/generate-ai-image` : '/api/generate-ai-image';
             
             const imgRes = await fetch(imgGenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: seg.imageGenPrompt })
             });

             if (imgRes.ok) {
                const imgJson = await imgRes.json();
                imageUrl = imgJson.imageUrl;
             } else {
                 const imgErr = await imgRes.json();
                 console.warn(`Art Generator failed for Segment ${i+1}:`, imgErr);
                 // Graceful Fallback
                 imageUrl = userImages.length > 0
                   ? (userImages[seg.imageIndex]?.url || userImages[0].url)
                   : (articles[seg.imageIndex]?.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(topic + "_" + i)}/1080/1920?blur=4`);
             }
         } else {
             imageUrl = userImages.length > 0
               ? (userImages[seg.imageIndex]?.url || userImages[0].url)
               : (articles[seg.imageIndex]?.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(topic + "_" + i)}/1080/1920?blur=4`);
         }

         finalizedSegments.push({
            ...seg,
            audioUrl,
            base64Audio,
            imageUrl
         });
      }

      setShortData({ ...scriptJson, segments: finalizedSegments });
      setLoadingStep('');
      setCurrentSegment(0);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during production workflow.');
      setLoadingStep('');
    }
  };

  // Re-generate individual scene visual using detailed visual prompts
  const regenerateSegmentImage = async (index: number) => {
    try {
      if (!shortData || !shortData.segments[index]) return;
      const seg = shortData.segments[index];
      const customPrompt = seg.imageGenPrompt || `Dynamic vertical photoreal background scene representing: ${seg.overlayText}`;

      setLoadingStep(`Synthesizing scene visual ${index + 1} with AI...`);
      setError(null);

      const APP_URL = process.env.APP_URL || '';
      const imgGenUrl = APP_URL ? `${APP_URL}/api/generate-ai-image` : '/api/generate-ai-image';
      
      const res = await fetch(imgGenUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ prompt: customPrompt })
      });

      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.error || `Visual Generator API returned ${res.status}`);
      }

      const imgJson = await res.json();
      
      const newSegments = [...shortData.segments];
      newSegments[index] = {
         ...newSegments[index],
         imageUrl: imgJson.imageUrl
      };

      setShortData({
         ...shortData,
         segments: newSegments
      });
      setLoadingStep('');
    } catch (err: any) {
       console.error(err);
       setError(err.message || "Could not regenerate graphic.");
       setLoadingStep('');
    }
  };

  const updateSegmentField = (index: number, field: string, value: any) => {
    if (!shortData) return;
    const newSegments = [...shortData.segments];
    newSegments[index] = {
       ...newSegments[index],
       [field]: value
    };
    setShortData({
       ...shortData,
       segments: newSegments
    });
  };

  useEffect(() => {
    if (isPlaying && shortData && shortData.segments[currentSegment]) {
      const audioUrl = shortData.segments[currentSegment].audioUrl;
      const overlayText = shortData.segments[currentSegment].overlayText;
      
      if (audioUrl && audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play().catch(console.error);
        
        audioRef.current.onended = () => {
          if (currentSegment < shortData.segments.length - 1) {
            setCurrentSegment(curr => curr + 1);
          } else {
            setIsPlaying(false);
            setCurrentSegment(0); // Reset
          }
        };
      } else {
        // Fallback if no audio generated: fake timeout
        const wordCount = overlayText.split(' ').length;
        const fakeDurationMs = Math.max(2000, wordCount * 400); 
        const t = setTimeout(() => {
            if (currentSegment < shortData.segments.length - 1) {
              setCurrentSegment(curr => curr + 1);
            } else {
              setIsPlaying(false);
              setCurrentSegment(0);
            }
        }, fakeDurationMs);
        return () => clearTimeout(t);
      }
    }
  }, [isPlaying, currentSegment, shortData]);

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    } else {
      if (currentSegment === shortData.segments.length - 1) {
         setCurrentSegment(0);
      }
      setIsPlaying(true);
    }
  };

  return (
    <div className="h-screen bg-[var(--color-bg)] text-[var(--color-text-main)] font-sans flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border-color)] flex items-center px-6 justify-between shrink-0">
        <div className="font-bold text-xl text-[var(--color-primary)] flex items-center gap-2">
            TrendToShorts <span className="font-light text-[var(--color-text-sub)] opacity-80">| AI Automator</span>
        </div>
        <div className="flex gap-5 items-center">
            <span className="bg-[#E6F4EA] text-[var(--color-accent)] px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">● System Active</span>
            <div className="w-8 h-8 bg-[#ddd] rounded-full"></div>
        </div>
      </header>

      {hasApiKey === false && (
        <div id="missing-api-key-banner" className="bg-[#FFF9E6] border-b border-[#FFECA4] text-[#8A6D00] px-6 py-2.5 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
              <div className="text-xs">
                 <span className="font-semibold">Gemini API Key Needed:</span> Automatic storyboarding, voice synthesizers, and premium AI image generators require your own API key. Configure it under <strong className="font-bold underline">Settings &gt; Secrets</strong> to unlock full capability.
              </div>
           </div>
           <span className="bg-amber-100 text-[#8A6D00] px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider select-none">
              Setup Pending
           </span>
        </div>
      )}

      {/* Main Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-[1px] bg-[var(--color-border-color)] overflow-hidden">
        
        {/* PANEL 1: Controls & Trends */}
        <section className="bg-[var(--color-surface)] flex flex-col p-5 overflow-y-auto">
          <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-sub)] mb-4 flex justify-between font-semibold">
            Trending Engine
          </h2>

          <div className="mb-6">
            <button
              onClick={fetchTrends}
              disabled={!!loadingStep}
              className="w-full py-3 px-4 rounded-lg font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-[var(--shadow-custom)] transition-opacity"
            >
              {loadingStep === 'Fetching Google Trends...' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Fetching Trends...</>
              ) : (
                <><TrendingUp className="w-4 h-4" /> Fetch Top Trends</>
              )}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
               <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
               <p className="text-xs text-red-600 leading-relaxed">{error}</p>
            </div>
          )}

          {topics.length > 0 && !topic && (
            <div className="mb-4">
               <h3 className="text-xs font-bold text-[var(--color-text-sub)] uppercase mb-3 text-center">Select a Topic</h3>
               <div className="flex flex-col gap-2">
                 {topics.map((t, idx) => (
                   <button 
                     key={idx}
                     onClick={() => fetchArticlesForTopic(t)}
                     disabled={!!loadingStep}
                     className="w-full text-left px-3 py-2 text-sm bg-[#F8F9FA] hover:bg-[#E8EAED] border border-[var(--color-border-color)] rounded transition-colors disabled:opacity-50"
                   >
                     <span className="font-bold text-[var(--color-primary)] mr-2">{idx + 1}.</span> {t}
                   </button>
                 ))}
               </div>
            </div>
          )}

          {topic && (
            <div className="mb-4">
               <div className="p-3 border border-[var(--color-primary)] rounded-lg bg-[#F1F3F4] shadow-sm">
                  <div className="font-semibold text-[0.9rem] mb-1 capitalize">{topic}</div>
                  <div className="text-[0.75rem] text-[var(--color-text-sub)]">
                    {loadingStep.startsWith('Fetching News') ? 'Fetching articles...' : 'Selected Topic • Articles Ready'}
                  </div>
               </div>
               
               <button
                 onClick={() => { setTopic(''); setTopics([]); fetchTrends(); }}
                 className="mt-3 w-full py-2 px-3 text-xs bg-white text-[var(--color-text-sub)] border border-[var(--color-border-color)] rounded hover:bg-gray-50 flex justify-center items-center gap-1"
               >
                 <RefreshCw className="w-3 h-3" /> Change Topic
               </button>
            </div>
          )}

          {topic && availableImages.length > 0 && (
            <div className="mt-auto pt-5 border-t border-[var(--color-border-color)]">
                <div className="flex justify-between items-center mb-2">
                   <h2 className="text-sm uppercase tracking-wider text-[var(--color-text-sub)] font-semibold">Select Visuals ({selectedImageIndices.size})</h2>
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto pr-1">
                    {availableImages.map((img) => {
                        const isSelected = selectedImageIndices.has(img.index);
                        return (
                            <div 
                               key={img.index} 
                               className={`aspect-square bg-gray-200 rounded shrink-0 overflow-hidden border-2 cursor-pointer relative transition-all ${isSelected ? 'border-[var(--color-primary)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                               onClick={() => {
                                   const newSet = new Set(selectedImageIndices);
                                   if (isSelected) {
                                       newSet.delete(img.index);
                                   } else {
                                       newSet.add(img.index);
                                   }
                                   setSelectedImageIndices(newSet);
                               }}
                            >
                               <img src={img.url} alt="Extracted asset" className="w-full h-full object-cover" />
                               {isSelected && (
                                   <div className="absolute top-1 right-1 bg-[var(--color-primary)] rounded-full w-4 h-4 flex justify-center items-center shadow-sm">
                                      <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                   </div>
                               )}
                            </div>
                        );
                    })}
                </div>
            </div>
          )}
        </section>

        {/* PANEL 2: Synthesis & Script */}
        <section className="bg-[var(--color-surface)] flex flex-col p-5 overflow-y-auto" id="synthesis-panel">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--color-border-color)]">
             <h2 className="text-[0.875rem] uppercase tracking-wider text-[var(--color-text-sub)] font-semibold flex items-center gap-1.5">
               <Mic className="w-4 h-4 text-[var(--color-primary)]" /> Storyboard & Vocals Studio
             </h2>
          </div>

          <div className="flex-grow min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
              {articles.length > 0 ? (
                 <div className="flex flex-col gap-4">
                    {/* Vocal Accent Selector & AI Graphics Mode Settings */}
                    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-150 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
                       <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                             <label className="text-[0.7rem] font-extrabold text-indigo-950 uppercase tracking-wider flex items-center gap-1">Speaker Voice Accent</label>
                             <select 
                                value={selectedVoice}
                                onChange={(e) => setSelectedVoice(e.target.value)}
                                className="w-full text-[0.8rem] p-2 bg-white border border-indigo-200 rounded-lg text-indigo-900 font-bold focus:ring-2 focus:ring-indigo-400 outline-none cursor-pointer"
                                disabled={!!loadingStep}
                             >
                                <option value="Puck">⚡ Puck (Energetic US)</option>
                                <option value="Kore">✨ Kore (Warm Accent)</option>
                                <option value="Fenrir">🎬 Fenrir (Nostalgic Film)</option>
                                <option value="Zephyr">🌪️ Zephyr (Fast-Paced Reporter)</option>
                             </select>
                          </div>
                          
                          <div className="flex flex-col gap-1.5 justify-center">
                             <label className="text-[0.7rem] font-extrabold text-indigo-950 uppercase tracking-wider">Graphics Method</label>
                             <div className="flex items-center gap-2 mt-1">
                                <input 
                                   type="checkbox"
                                   id="ai-image-toggle"
                                   checked={useAIGraphicSystem}
                                   onChange={(e) => setUseAIGraphicSystem(e.target.checked)}
                                   className="w-4 h-4 text-indigo-600 border-indigo-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                                <label htmlFor="ai-image-toggle" className="text-[0.75rem] font-bold text-indigo-900 cursor-pointer select-none">
                                   Bespoke AI Arts
                                </label>
                             </div>
                          </div>
                       </div>
                       
                       {!shortData && (
                          <button
                              onClick={generateShorts}
                              disabled={!!loadingStep}
                              className="w-full py-2.5 px-4 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                          >
                              {loadingStep ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                              Generate Script & Audio ({useAIGraphicSystem ? 'With AI' : 'Scraped Only'})
                          </button>
                       )}
                    </div>

                    {/* Standard Scraped Raw Articles info underneath if NOT generated yet */}
                    {!shortData && (
                       <div className="flex flex-col gap-3">
                          <span className="text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider">Sourced Raw Articles context</span>
                          {articles.map((a, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 border border-[var(--color-border-color)] rounded-lg bg-gray-50/70 transition-hover hover:border-gray-300">
                                <div className="flex gap-3">
                                    <div className="w-[70px] h-[55px] bg-[#eee] rounded-md flex-shrink-0 overflow-hidden border border-[#ddd]">
                                        <img src={a.imageUrl || `https://picsum.photos/seed/${encodeURIComponent(topic + "_" + i)}/1080/1920?blur=4`} alt="thumbnail" className="w-[70px] h-[55px] object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[0.65rem] text-[var(--color-primary)] font-extrabold uppercase mb-0.5">{a.source || "UNKNOWN SOURCE"}</div>
                                        <h3 className="text-[0.8rem] leading-[1.25] font-semibold text-[var(--color-text-main)] line-clamp-2">{a.title}</h3>
                                    </div>
                                </div>
                            </div>
                          ))}
                       </div>
                    )}
                 </div>
              ) : (
                 <div className="text-center text-[var(--color-text-sub)] text-sm py-12 opacity-60 font-semibold border border-dashed border-gray-200 rounded-xl">
                   No articles fetched yet. Select a trending topic first.
                 </div>
              )}

              {/* STORYBOARD STUDIO (IF GENERATED) */}
              {shortData && (
                 <div className="flex flex-col gap-4 mt-2">
                    <div className="flex justify-between items-center pb-1">
                       <span className="text-[0.75rem] font-extrabold text-[var(--color-text-sub)] uppercase tracking-wider">Interactive Scene Storyboard</span>
                    </div>

                    <div className="flex flex-col gap-4">
                       {shortData.segments.map((seg: any, i: number) => {
                          const isActive = currentSegment === i;
                          return (
                             <div 
                                key={i} 
                                className={`flex flex-col gap-3 p-3.5 border rounded-xl transition-all ${isActive ? 'bg-indigo-50/50 border-indigo-400 ring-1 ring-indigo-400 shadow-sm' : 'bg-[#f8f9fa] border-gray-200 hover:border-gray-300'}`}
                             >
                                {/* Scene Title Banner */}
                                <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                                   <div className="flex items-center gap-1.5">
                                      <span className={`text-[0.7rem] font-black uppercase px-2 py-0.5 rounded-full ${isActive ? 'bg-indigo-600 text-white' : 'bg-gray-250 text-gray-700'}`}>
                                         Scene {i+1}
                                      </span>
                                      {isActive && <span className="text-[10px] text-indigo-600 font-bold animate-pulse">● Live Previewing</span>}
                                   </div>
                                   <button 
                                      onClick={() => setCurrentSegment(i)}
                                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                                   >
                                      Select scene
                                   </button>
                                </div>

                                <div className="flex gap-3">
                                   {/* Column Left: Visual Miniature thumbnail */}
                                   <div className="flex flex-col gap-1.5 items-center">
                                      <div className="w-[70px] h-[100px] rounded-lg bg-black overflow-hidden border border-gray-300 shadow-sm relative">
                                         <img src={seg.imageUrl} alt={`Scene ${i+1}`} className="w-full h-full object-cover" />
                                      </div>
                                   </div>

                                   {/* Column Right: Editable controls */}
                                   <div className="flex-1 flex flex-col gap-2">
                                      {/* Spoken script dialog */}
                                      <div className="flex flex-col gap-1">
                                         <span className="text-[9px] uppercase font-bold text-gray-500">Narration Script (Voiceover)</span>
                                         <textarea 
                                            value={seg.narration}
                                            onChange={(e) => updateSegmentField(i, 'narration', e.target.value)}
                                            rows={2}
                                            className="w-full text-xs p-1.5 bg-white border border-gray-200 rounded-md text-gray-700 outline-none focus:border-indigo-400 resize-none font-medium leading-relaxed"
                                         />
                                      </div>

                                      {/* Captions */}
                                      <div className="grid grid-cols-1 gap-2">
                                         <div className="flex flex-col gap-1">
                                            <span className="text-[9px] uppercase font-bold text-gray-500">Screen Captions (Overlay UPPERCASE)</span>
                                            <input 
                                               type="text"
                                               value={seg.overlayText || ''}
                                               onChange={(e) => updateSegmentField(i, 'overlayText', e.target.value)}
                                               className="w-full text-xs p-1.5 bg-white border border-gray-200 rounded-md font-extrabold uppercase tracking-wide text-gray-900 outline-none focus:border-indigo-400"
                                            />
                                         </div>
                                      </div>
                                   </div>
                                </div>

                                {/* Creative Visual GenAI Control */}
                                <div className="bg-white p-2.5 rounded-lg border border-gray-150 flex flex-col gap-2">
                                   <span className="text-[9px] uppercase font-mono font-bold text-indigo-800">Bespoke Visual Gemini Prompt</span>
                                   <textarea 
                                      value={seg.imageGenPrompt || ''}
                                      onChange={(e) => updateSegmentField(i, 'imageGenPrompt', e.target.value)}
                                      rows={2}
                                      className="w-full text-[10px] p-1 bg-gray-50 border border-gray-100 font-mono rounded text-gray-600 outline-none focus:border-indigo-400 resize-none"
                                   />
                                   <div className="flex justify-end mt-1">
                                      <button
                                         onClick={() => regenerateSegmentImage(i)}
                                         disabled={!!loadingStep}
                                         className="py-1 px-2.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold rounded-md shadow-sm border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40"
                                      >
                                         <Sparkles className="w-3 h-3 text-indigo-500" /> AI Art Generator
                                      </button>
                                   </div>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 </div>
              )}
          </div>

          <div className="flex justify-between items-center mt-auto p-2.5 bg-[#f1f3f4] rounded text-[0.7rem] font-bold shrink-0">
             <span className={topic ? "text-[var(--color-accent)]" : "text-[var(--color-text-sub)]"}>SCRAPE {topic && "✓"}</span>
             <span className={shortData ? "text-[var(--color-accent)]" : "text-[var(--color-text-sub)]"}>SUMMARIZE {shortData && "✓"}</span>
             <span className={loadingStep.startsWith('Synthesizing') ? "text-[var(--color-primary)] font-extrabold" : (shortData && !loadingStep ? "text-[var(--color-accent)]" : "text-[#ccc]")}>{shortData && !loadingStep ? "VOCALS READY ✓" : "VOCALS..."}</span>
             <span className="text-[#ccc]">UPLOAD</span>
          </div>
        </section>

        {/* PANEL 3: Preview */}
        <section className="bg-[var(--color-surface)] flex flex-col p-5 overflow-y-auto">
          <div className="flex justify-between items-start mb-5">
             <h2 className="text-[0.875rem] uppercase tracking-wider text-[var(--color-text-sub)] font-semibold flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4" /> Short Preview
             </h2>
             <select 
                 value={template} 
                 onChange={(e) => setTemplate(e.target.value)}
                 className="text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1 outline-none font-semibold text-gray-700 cursor-pointer"
             >
                 {VIDEO_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
             </select>
          </div>

          {groundingLimitReached && (
             <div className="mb-4 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-start gap-2">
                   <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
                   <div className="text-xs text-indigo-950 leading-relaxed font-bold">
                      Grounding Quota Notice:
                   </div>
                </div>
                <div className="text-[11px] text-indigo-800 leading-normal pl-6 font-medium">
                   The free shared Gemini key has touched its temporary quota limit. To unlock limitless real-time search, configure your personal <span className="font-bold text-indigo-950">GEMINI_API_KEY</span> in the <span className="font-bold text-indigo-950">Settings</span> menu.
                </div>
                <div className="text-[10px] text-indigo-600 font-bold pl-6 border-t border-indigo-100/50 pt-1.5">
                   💡 Activating backup high-resolution Google News crawler flow safely.
                </div>
             </div>
          )}

          {usedFallback && (
             <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 shadow-sm">
                <Sparkles className="w-4.5 h-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-normal">
                   <span className="font-bold">Quota-Optimization Active:</span> We switched dynamically to standard high-speed <span className="font-semibold text-amber-950">Gemini 3.5 Flash</span> to bypass Pro-tier API rate limits. Your script compiled successfully!
                </div>
             </div>
          )}
          
          <div className="flex flex-col items-center flex-1">
             <div className="w-[280px] h-[497px] bg-black rounded-[24px] relative overflow-hidden border-[8px] border-[#333] shrink-0 shadow-xl">
                <audio ref={audioRef} className="hidden" />
                <canvas ref={canvasRef} className="hidden" />
                
                {isRendering && (
                   <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                      <Loader2 className="w-12 h-12 text-[var(--color-primary)] animate-spin mb-4" />
                      <h3 className="text-white font-bold text-lg mb-2">Rendering Video</h3>
                      <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-2">
                         <div 
                            className="h-full bg-[var(--color-primary)] transition-all duration-300"
                            style={{ width: `${renderProgress}%` }}
                         />
                      </div>
                      <p className="text-white/60 text-xs uppercase tracking-widest font-semibold">{Math.round(renderProgress)}% COMPLETE</p>
                      <p className="text-white/40 text-[10px] mt-4 leading-relaxed">Stitching visuals and audio narration...</p>
                   </div>
                )}

                {shortData ? (
                  <div className={`absolute inset-0 flex items-center justify-center bg-black overflow-hidden ${template === 'minimal' ? 'bg-zinc-900' : ''}`}>
                     <div className="absolute w-full h-full bg-gradient-to-b from-transparent via-transparent to-black/65 z-10 pointer-events-none"></div>
                     {shortData.segments.map((seg: any, idx: number) => {
                        const activeTpl = VIDEO_TEMPLATES.find(t => t.id === template) || VIDEO_TEMPLATES[0];
                        return (
                           <div 
                              key={idx}
                              className={`absolute inset-0 w-full h-full bg-cover bg-center origin-center ${activeTpl.transition} ${idx === currentSegment ? activeTpl.activeImg : activeTpl.inactiveImg}`}
                              style={{ backgroundImage: `url(${seg.imageUrl})` }}
                           />
                        );
                     })}
                     
                     {shortData.segments[currentSegment]?.overlayText && (() => {
                         const activeTpl = VIDEO_TEMPLATES.find(t => t.id === template) || VIDEO_TEMPLATES[0];
                         return (
                            <div className={activeTpl.textContainer}>
                               <div className={activeTpl.textStyle}>
                                   {shortData.segments[currentSegment]?.overlayText}
                               </div>
                            </div>
                         );
                     })()}

                     <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20">
                        <div 
                           className="h-full bg-[var(--color-primary)] transition-all duration-[200ms] ease-out" 
                           style={{ width: `${((currentSegment + 1) / shortData.segments.length) * 100}%` }}
                        ></div>
                     </div>

                     {/* The Play button overlays over the video */}
                     <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                         <button 
                            onClick={togglePlay}
                            className="bg-black/50 text-white rounded-full p-4 pointer-events-auto hover:bg-black/70 backdrop-blur-sm transition-transform active:scale-95 border border-white/10"
                         >
                            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                         </button>
                     </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-black/10 to-black/80">
                     <div className="w-full h-full bg-cover bg-center opacity-60 flex flex-col justify-center items-center text-gray-500 gap-2 p-6 text-center" 
                          style={{ backgroundImage: `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23333"/></svg>')` }}>
                         <Play className="w-12 h-12 text-white/20" />
                     </div>
                  </div>
                )}
             </div>

             <div className="w-full mt-5">
                <div className="flex justify-between text-[0.8rem] mb-3 text-[var(--color-text-main)]">
                   <span>Estimated Duration</span>
                   <span className="font-bold">00:54</span>
                </div>
                <button 
                   disabled={!shortData || isRendering}
                   onClick={renderVideo}
                   className="w-full py-3 bg-[var(--color-primary)] text-white border-none rounded-lg font-bold cursor-pointer disabled:opacity-50 transition-opacity flex justify-center items-center gap-2 mb-3 shadow-md active:scale-[0.98]"
                >
                   {isRendering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                   {isRendering ? `Rendering... ${Math.round(renderProgress)}%` : 'Render & Download MP4'}
                </button>
                <button 
                   disabled={!shortData || isRendering}
                   onClick={downloadJSONData}
                   className="w-full py-2 bg-white text-[var(--color-text-sub)] border border-[var(--color-border-color)] rounded-lg font-bold cursor-pointer disabled:opacity-50 disabled:bg-gray-50 transition-colors text-xs flex justify-center items-center gap-2"
                >
                   Export JSON Metadata
                </button>
             </div>
          </div>
        </section>

      </main>
    </div>
  );
}
