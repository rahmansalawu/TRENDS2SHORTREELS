import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }
});

async function test() {
  const trendsFeed = await parser.parseURL('https://trends.google.com/trending/rss?geo=US');
  const topTerm = trendsFeed.items[0].title;
  console.log("Top Trend:", topTerm);
  
  const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(topTerm)}&hl=en-US&gl=US&ceid=US:en`;
  const newsFeed = await parser.parseURL(newsUrl);
  const article = newsFeed.items[0];
  console.log("Article Keys:", Object.keys(article));
  console.log("Article Link:", article.link);
  console.log("Article Snippet:", article.contentSnippet);
  console.log("Article Content:", article.content);
  
  const res = await fetch(article.link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } });
  console.log("Final URL:", res.url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Try to find the actual article URL. Usually inside a <meta http-equiv="refresh"> or <a href="...">
  let actualUrl = "";
  const refresh = $('meta[http-equiv="refresh"]').attr('content');
  if (refresh) {
      const match = refresh.match(/URL='([^']+)'/i) || refresh.match(/URL="([^"]+)"/i) || refresh.match(/URL=(.+)$/i);
      if (match) actualUrl = match[1];
  }
  
  if (!actualUrl) {
      actualUrl = $('a').first().attr('href');
  }
  
  console.log("HTML:", html);
  
  if (actualUrl && actualUrl.startsWith('http')) {
      const actualRes = await fetch(actualUrl, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' } });
      const actualHtml = await actualRes.text();
      const $actual = cheerio.load(actualHtml);
      
      const ogImg = $actual('meta[property="og:image"]').attr('content');
      console.log("Actual OG Image:", ogImg);
      
      const text = $actual('p').map((i, el) => $actual(el).text()).get().join(' ').substring(0, 200);
      console.log("Actual Text:", text);
  }
}
test();
