import Parser from 'rss-parser';
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});
async function go() {
    const feed = await parser.parseURL("https://news.google.com/rss/search?q=apple&hl=en-US&gl=US&ceid=US:en");
    const first = feed.items[0];
    console.log(JSON.stringify(first, null, 2));
}
go();
