const crypto = require('crypto');

const SVC_ACC = {
    client_email: "salesforce-gemini@schranders.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJbITgR/RnALiZ\nRpCkbZz0I64RluuxyjO20a/YL4uXhfusby2Bxikhv9BoXOipPGDA3mOW4AeUV1Dd\nRQRvuLv9089PRguiCeawubcgdIHDACttuUsQJ2B81Mr/9Vdkv/Toh+1yJhEp6GOA\nOq2Wzw00M+O0BeUdJ/86XgLBN11z67n7ypq1QWqKZENuAVjbAvgWRiDk1thkukQi\nUrGTnh07iUQE6f4BC7z4BCnEqjZbKvcgDO1TzdilXAU3l37tmveZ7sJq6PM4nEYy\nk1DHdCYHT4ZPxtFGLFOl34oqSfYtrxmkHOYkfJMTXlc/FhqM1pPNpvtTXJM0dsiI\nZrIjRiv7AgMBAAECggEAOzKOls/u73rRxhJsHjcs4r+9v+OoH5d6vWdBE/tdPkod\nXl9Kc5KGsimKmbF8m4hoMybpBAWRlLJYzL8k/6S+c2oVyomej5/zUcszG/HB1Uqu\neM/1VKkN/YIYq0MyzSRxWQnh6iNv9e4bmCsmq2Tsz4PUjysQXBJOO5w3mQuphpCi\nFHcqMATP8qmlawzizvy5MZR4bvXKFJ3xakqoBuSeDVDpRSBkycfpTEyP7JRGwWNs\ngSY4sKMBtxVySPTF5gFkwjAL9hO3SvuPDsRpJsukBUYamvBzK+LQ52GFakinV5ua\njlIVXsmjDyDn9RpdOF9zif1tEjcdy2gEUEJOwSRzAQKBgQD4WJoa+JpOVQSZa+mN\nB4JOXZbAtdg+6g9DMEqIbIFWOPE0q5d5gd+rEKTMAqrTioXv9X0Oj21xqhXY1WHD\nDXlQAIZur/8xx7CIQnRzjK59YVuG4wqpRKvtzZ6QrRT4c18VNkk7kALHXZuA1/6S\nlb3PY4mniw8Zb9n511Cs7DXNgQKBgQDPobX8dU5drJZGs3jWIOO+6q1okIWOj9BW\nhhSforzbL9nG1QbyCiyuJrhEeerR+RZL1XMLPbOql5oaECnCsmEtD5Fr00RGxKgk\nkUuraWnR1qnSWqG7ab5uIsIS5Bewb8ALvXjP+51Z+yrurBGIU9wYMh6dnoocC6SI\ngtMgRRHvewKBgQC+nktSzmSqIUmRdSnjrNLQ0bcHncwopkEmwidDRX2Ur8o8MkTm\n58/FHtZPHPD/xACAKX5esapAp1tzfn02WN43kN+ekAohrHOMcu2tT1sTM6osA5LI\nT8RjmALQa3mAJhXiUzOsuyHW4rucDq4A11zElVMwPWVOkfLOeP0cbYXygQKBgByO\ny28b21l7AXhb+wTIpUp/ELbPGe+PzEH6Ux/ZzEwBetykND5aM+cIIFQayLd0oSJx\nC0/CftG55FItYvEKg98kwwWnmz54kf/llBjReOKJufXazV/vnWeclEDw6mk0FaAH\nwXQp0Wys5SzKseakUiNp0VgwlCJjX4//HnbTyTG9AoGBALET+Do6sOwpvMwHwmVs\npKMt+pDIykyrfDke706iHky3TtYifIFx8AJMA8/yUNi3l80lxrU1SOizSHeOrV9U\nDhG4gDB7tOaj83pL1ZYMoUf2FsnXwEdSjbthevxPAVtzN5exap+Jm3XIOQ3RE1RL\neh7BOAKUj4mBbGq6wLo1RXzs\n-----END PRIVATE KEY-----\n"
};

function getAccessToken() {
    const scope = "https://www.googleapis.com/auth/cloud-platform";
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString('base64url');
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = Buffer.from(JSON.stringify({
        iss: SVC_ACC.client_email,
        sub: SVC_ACC.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat, exp, scope
    })).toString('base64url');

    const unsignedJwt = header + "." + payload;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(unsignedJwt);
    const signature = sign.sign(SVC_ACC.private_key, 'base64url');
    const signedJwt = unsignedJwt + "." + signature;

    return fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: signedJwt
        })
    }).then(res => res.json()).then(data => data.access_token);
}

async function testEndpoint(region, modelName) {
    const token = await getAccessToken();
    const endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/schranders/locations/${region}/publishers/google/models/${modelName}:generateContent`;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
    });
    console.log(region, modelName, res.status);
    if (!res.ok) {
        console.log(await res.text());
    } else {
        console.log("SUCCESS!");
    }
}

async function doTests() {
    await testEndpoint("us-central1", "gemini-1.5-flash");
    await testEndpoint("us-east1", "gemini-1.5-flash");
    await testEndpoint("us-east1", "gemini-2.0-flash-exp");
    await testEndpoint("us-central1", "gemini-2.5-flash");
}
doTests();
