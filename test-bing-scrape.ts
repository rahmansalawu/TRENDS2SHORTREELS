import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

async function go() {
    const topTerm = "apple";
    const newsUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(topTerm)}&format=rss`;
    const newsFeed = await parser.parseURL(newsUrl);
    const topArticles = newsFeed.items.slice(0, 5);
    
    for (const article of topArticles) {
        if (!article.link) continue;
        let realUrl = article.link;
        
        try {
            const urlObj = new URL(article.link);
            const targetUrl = urlObj.searchParams.get('url');
            if (targetUrl) {
                realUrl = targetUrl;
            }
        } catch(e) {}
        
        console.log("Real URL:", realUrl);
        
        try {
            const res = await fetch(realUrl, {
                headers: {
                   'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const html = await res.text();
            const $ = cheerio.load(html);
            let imageUrl = $('meta[property="og:image"]').attr('content') || 
                           $('meta[name="twitter:image"]').attr('content');
            
            console.log("Found Image:", imageUrl ? imageUrl : "None");
        } catch(e) {
            console.log("Fetch failed", e.message);
        }
    }
}
go();
