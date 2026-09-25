import Parser from 'rss-parser';
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});
async function go() {
    try {
        const feed = await parser.parseURL("https://www.bing.com/news/search?q=apple&format=rss");
        console.log(JSON.stringify(feed.items[0], null, 2));
    } catch(e) { console.error(e) }
}
go();
