import * as cheerio from 'cheerio';

async function testFetch() {
    const url = "https://news.google.com/rss/articles/CBMigANBVV95cUxNWjV5SXRZYWF1MXktbEFTNGJZNXFhZ0U4dGVUYzNiQmJsMk14aDV5REhFTWlYQTNBREp3X2lqQXZ2eTNFZW1xOEFSNGh3SnhnUU1LdmRHR1hnVkd4Zm1DUFlxTXp3Ny02cXY2azI1TDYwZjBpNGdoTEdoSG43RzY0QU5DWUxOd0htV1ZCejlTVGxmVUdMQ1VWSlhrQkVTT0RCQm9uY1VraDY1ZUVReDJTZGc1WEkxMnZuMWEwN04zMFVMUmxFMk5sTzZ3ODNDNURBRGNCOW0zbHBnT2FLZTQ0Qm5ja2Q2OU5feFJSNlBPNGR3Z1dhNk9uOU94UndkVHNuMmw1YzlmZVNvMVJnWTdhaUlqSFE3ZjNvQUloZlN2NGlPMTExbHdFZFAxUUxwU0NndDI3VVNXNjFEbDBPaDJMcVJnMG1OVGRIRndsY1pvbzN0c0UxZDlKcGF3bzlXMEdsd0VoVlFaX3NfZXc1UFctc3JxVHVlUDQ0aUdyMFY2ajU?oc=5";
    
    // Attempt to decode URL base64
    let targetUrl = url;
    if (url.includes('/articles/')) {
        try {
            let base64Code = url.split('/articles/')[1].split('?')[0];
            // Fix base64url encoding
            base64Code = base64Code.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = Buffer.from(base64Code, 'base64').toString('ascii');
            console.log("Raw decoded:", decoded);
            const match = decoded.match(/https?:\/\/[^\s\x00-\x1f\x7f-\xff]+/);
            if (match) {
                targetUrl = match[0];
                console.log("Decoded target URL:", targetUrl);
            }
        } catch (e) {
            console.error("Decoding error:", e);
        }
    }

    try {
        const res = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        let imageUrl = $('meta[property="og:image"]').attr('content') || 
                       $('meta[name="twitter:image"]').attr('content');
                       
        console.log("og:image =", imageUrl);
        
        if (!imageUrl) {
            imageUrl = $('article img').first().attr('src') || $('img').first().attr('src');
            console.log("fallback image =", imageUrl);
        }
        
    } catch(e) {
        console.error(e);
    }
}

testFetch();
