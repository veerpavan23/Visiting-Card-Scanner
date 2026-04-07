/**
 * Vercel Edge Runtime - Enterprise Card Extraction
 * Runtime: Edge (High Speed, Free Tier)
 * Region: us-east1 (Sync with Project Config)
 */

export const config = { runtime: 'edge' };

// Service Account Config
const SVC_ACC = {
    client_email: "salesforce-gemini@schranders.iam.gserviceaccount.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDJbITgR/RnALiZ\nRpCkbZz0I64RluuxyjO20a/YL4uXhfusby2Bxikhv9BoXOipPGDA3mOW4AeUV1Dd\nRQRvuLv9089PRguiCeawubcgdIHDACttuUsQJ2B81Mr/9Vdkv/Toh+1yJhEp6GOA\nOq2Wzw00M+O0BeUdJ/86XgLBN11z67n7ypq1QWqKZENuAVjbAvgWRiDk1thkukQi\nUrGTnh07iUQE6f4BC7z4BCnEqjZbKvcgDO1TzdilXAU3l37tmveZ7sJq6PM4nEYy\nk1DHdCYHT4ZPxtFGLFOl34oqSfYtrxmkHOYkfJMTXlc/FhqM1pPNpvtTXJM0dsiI\nZrIjRiv7AgMBAAECggEAOzKOls/u73rRxhJsHjcs4r+9v+OoH5d6vWdBE/tdPkod\nXl9Kc5KGsimKmbF8m4hoMybpBAWRlLJYzL8k/6S+c2oVyomej5/zUcszG/HB1Uqu\neM/1VKkN/YIYq0MyzSRxWQnh6iNv9e4bmCsmq2Tsz4PUjysQXBJOO5w3mQuphpCi\nFHcqMATP8qmlawzizvy5MZR4bvXKFJ3xakqoBuSeDVDpRSBkycfpTEyP7JRGwWNs\ngSY4sKMBtxVySPTF5gFkwjAL9hO3SvuPDsRpJsukBUYamvBzK+LQ52GFakinV5ua\njlIVXsmjDyDn9RpdOF9zif1tEjcdy2gEUEJOwSRzAQKBgQD4WJoa+JpOVQSZa+mN\nB4JOXZbAtdg+6g9DMEqIbIFWOPE0q5d5gd+rEKTMAqrTioXv9X0Oj21xqhXY1WHD\nDXlQAIZur/8xx7CIQnRzjK59YVuG4wqpRKvtzZ6QrRT4c18VNkk7kALHXZuA1/6S\nlb3PY4mniw8Zb9n511Cs7DXNgQKBgQDPobX8dU5drJZGs3jWIOO+6q1okIWOj9BW\nhhSforzbL9nG1QbyCiyuJrhEeerR+RZL1XMLPbOql5oaECnCsmEtD5Fr00RGxKgk\nkUuraWnR1qnSWqG7ab5uIsIS5Bewb8ALvXjP+51Z+yrurBGIU9wYMh6dnoocC6SI\ngtMgRRHvewKBgQC+nktSzmSqIUmRdSnjrNLQ0bcHncwopkEmwidDRX2Ur8o8MkTm\n58/FHtZPHPD/xACAKX5esapAp1tzfn02WN43kN+ekAohrHOMcu2tT1sTM6osA5LI\nT8RjmALQa3mAJhXiUzOsuyHW4rucDq4A11zElVMwPWVOkfLOeP0cbYXygQKBgByO\ny28b21l7AXhb+wTIpUp/ELbPGe+PzEH6Ux/ZzEwBetykND5aM+cIIFQayLd0oSJx\nC0/CftG55FItYvEKg98kwwWnmz54kf/llBjReOKJufXazV/vnWeclEDw6mk0FaAH\nwXQp0Wys5SzKseakUiNp0VgwlCJjX4//HnbTyTG9AoGBALET+Do6sOwpvMwHwmVs\npKMt+pDIykyrfDke706iHky3TtYifIFx8AJMA8/yUNi3l80lxrU1SOizSHeOrV9U\nDhG4gDB7tOaj83pL1ZYMoUf2FsnXwEdSjbthevxPAVtzN5exap+Jm3XIOQ3RE1RL\neh7BOAKUj4mBbGq6wLo1RXzs\n-----END PRIVATE KEY-----\n"
};

async function getAccessToken() {
    const scope = "https://www.googleapis.com/auth/cloud-platform";
    const header = JSON.stringify({ alg: "RS256", typ: "JWT" });
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const payload = JSON.stringify({
        iss: SVC_ACC.client_email,
        sub: SVC_ACC.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat, exp, scope
    });

    const body = btoa(header).replace(/=/g, "") + "." + btoa(payload).replace(/=/g, "");
    const pem = SVC_ACC.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----|\n/g, "");
    const binaryKey = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false, ["sign"]
    );

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(body)
    );

    const signedJwt = body + "." + btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    const resp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: signedJwt
        })
    });

    const data = await resp.json();
    return data.access_token;
}

export default async function handler(req) {
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    
    try {
        const { imageData, mimeType, ping } = await req.json();
        if (ping) return new Response(JSON.stringify({ status: 'ACTIVE' }), { headers: { 'Content-Type': 'application/json' } });
        
        const base64Data = imageData.split(',')[1];
        const token = await getAccessToken();
        const prompt = `Extract card details. Return ONLY raw JSON with these keys: name, company, designation, phone, email, website, address. JSON ARRAY: [{"FirstName"...}]`;
        const project = "schranders";
        const endpoint = `https://us-east1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-east1/publishers/google/models/gemini-2.5-flash:generateContent`;

        const resp = await fetch(endpoint, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } }
                    ]
                }]
            })
        });

        if (resp.ok) {
            const data = await resp.json();
            return new Response(JSON.stringify(data), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            const err = await resp.json();
            return new Response(JSON.stringify({ error: err }), { status: resp.status });
        }

    } catch (err) {
        return new Response(JSON.stringify({ error: { message: "Critical Engine Failure: " + err.message } }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
