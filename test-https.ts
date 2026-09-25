import https from 'https';

function fetchLargeUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxHeaderSize: 65536 // 64KB
        }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // handle redirect
                return fetchLargeUrl(res.headers.location).then(resolve).catch(reject);
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}
async function test() {
    try {
        const html = await fetchLargeUrl("https://finance.yahoo.com/markets/stocks/articles/too-buy-globalstar-stock-following-125202395.html");
        console.log("Success with HTTPS! html length:", html.length);
    } catch(e) {
        console.error("HTTPS error:", e.message);
    }
}
test();
