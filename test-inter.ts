import * as cheerio from 'cheerio';

async function testInterstitial() {
    const url = "https://news.google.com/rss/articles/CBMigANBVV95cUxNWjV5SXRZYWF1MXktbEFTNGJZNXFhZ0U4dGVUYzNiQmJsMk14aDV5REhFTWlYQTNBREp3X2lqQXZ2eTNFZW1xOEFSNGh3SnhnUU1LdmRHR1hnVkd4Zm1DUFlxTXp3Ny02cXY2azI1TDYwZjBpNGdoTEdoSG43RzY0QU5DWUxOd0htV1ZCejlTVGxmVUdMQ1VWSlhrQkVTT0RCQm9uY1VraDY1ZUVReDJTZGc1WEkxMnZuMWEwN04zMFVMUmxFMk5sTzZ3ODNDNURBRGNCOW0zbHBnT2FLZTQ0Qm5ja2Q2OU5feFJSNlBPNGR3Z1dhNk9uOU94UndkVHNuMmw1YzlmZVNvMVJnWTdhaUlqSFE3ZjNvQUloZlN2NGlPMTExbHdFZFAxUUxwU0NndDI3VVNXNjFEbDBPaDJMcVJnMG1OVGRIRndsY1pvbzN0c0UxZDlKcGF3bzlXMEdsd0VoVlFaX3NfZXc1UFctc3JxVHVlUDQ0aUdyMFY2ajU?oc=5";

    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const html = await res.text();
    console.log("HTML Start:", html.substring(0, 1000));
    console.log("HTML End:", html.substring(html.length - 1000));
    const $ = cheerio.load(html);
    
    // Look for <a href="..."> inside the article body or standard interstitial <c-wiz>
    const link1 = $('a').first().attr('href');
    const link2 = $('c-wiz a').attr('href');
    console.log("Interstitial link1:", link1);
    console.log("Interstitial link2:", link2);

    // Some pages use this regex format for data attributes
    const realUrlMatch = html.match(/data-n-v-u="([^"]+)"/);
    if(realUrlMatch) console.log("Real URL match:", realUrlMatch[1]);
    
    // Find all 'http' strings just in case
    const httpMatches = html.match(/(https?:\/\/[a-zA-Z0-9.\-_\/=&?%]+)/g);
    if (httpMatches) {
        const potential = httpMatches.filter(l => !l.includes('google') && !l.includes('w3.org'));
        console.log("Potential URLs in HTML:", potential.slice(0, 5));
    }
}
testInterstitial();
