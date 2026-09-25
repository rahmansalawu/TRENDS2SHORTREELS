const url = "https://news.google.com/rss/articles/CBMigANBVV95cUxNWjV5SXRZYWF1MXktbEFTNGJZNXFhZ0U4dGVUYzNiQmJsMk14aDV5REhFTWlYQTNBREp3X2lqQXZ2eTNFZW1xOEFSNGh3SnhnUU1LdmRHR1hnVkd4Zm1DUFlxTXp3Ny02cXY2azI1TDYwZjBpNGdoTEdoSG43RzY0QU5DWUxOd0htV1ZCejlTVGxmVUdMQ1VWSlhrQkVTT0RCQm9uY1VraDY1ZUVReDJTZGc1WEkxMnZuMWEwN04zMFVMUmxFMk5sTzZ3ODNDNURBRGNCOW0zbHBnT2FLZTQ0Qm5ja2Q2OU5feFJSNlBPNGR3Z1dhNk9uOU94UndkVHNuMmw1YzlmZVNvMVJnWTdhaUlqSFE3ZjNvQUloZlN2NGlPMTExbHdFZFAxUUxwU0NndDI3VVNXNjFEbDBPaDJMcVJnMG1OVGRIRndsY1pvbzN0c0UxZDlKcGF3bzlXMEdsd0VoVlFaX3NfZXc1UFctc3JxVHVlUDQ0aUdyMFY2ajU?oc=5";

async function testRedirect() {
    const res = await fetch(url, { 
        redirect: 'manual',
    });
    console.log("Status:", res.status);
    console.log("Location:", res.headers.get('location'));
}
testRedirect();
