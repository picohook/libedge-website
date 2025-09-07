// worker-translator.js - Geliştirilmiş ve Basitleştirilmiş Kimlik Doğrulama Kodu

// Gelen tüm isteklere CORS başlıklarını ekleyen yardımcı fonksiyon
function addCorsHeaders(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// Google API'si için kimlik doğrulama token'ı alan fonksiyon
async function getAccessToken(sa_email, sa_private_key) {
  const authUrl = 'https://www.googleapis.com/oauth2/v4/token';
  const claims = {
    iss: sa_email,
    scope: 'https://www.googleapis.com/auth/cloud-translation',
    aud: authUrl,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  };
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  
  // Base64Url-safe encoding
  const base64UrlEncode = (str) => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const encodedJwtHeader = base64UrlEncode(JSON.stringify(jwtHeader));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const toSign = `${encodedJwtHeader}.${encodedClaims}`;

  // Basitleştirilmiş ve daha güvenilir anahtar import etme yöntemi
  const keyData = new TextEncoder().encode(sa_private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(toSign));
  const encodedSignature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${toSign}.${encodedSignature}`;

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await response.json();
  if (!data.access_token) {
    console.error("Token alınamadı:", JSON.stringify(data));
    throw new Error('Google\'dan access token alınamadı.');
  }
  return data.access_token;
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  const text = url.searchParams.get("text");
  const target = url.searchParams.get("target");

  if (!text || !target) {
    const errorResponse = new Response(JSON.stringify({ error: "Gerekli 'text' ve 'target' parametreleri eksik." }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400
    });
    return addCorsHeaders(errorResponse);
  }

  try {
    const project_id = env.SA_PROJECT_ID;
    const sa_email = env.SA_CLIENT_EMAIL;
    const sa_private_key = env.SA_PRIVATE_KEY.replace(/\\n/g, '\n');

    const accessToken = await getAccessToken(sa_email, sa_private_key);
    const translateUrl = `https://translation.googleapis.com/v3/projects/${project_id}:translateText`;
    
    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        contents: [text],
        targetLanguageCode: target,
        mimeType: 'text/plain',
      })
    });

    if (!translateResponse.ok) {
       const errorBody = await translateResponse.text();
       throw new Error(`Google API Hatası: ${translateResponse.status} - ${errorBody}`);
    }

    const translateData = await translateResponse.json();
    const translatedText = translateData.translations[0].translatedText;

    const successResponse = new Response(JSON.stringify({
      data: { translations: [{ translatedText: translatedText }] }
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
    return addCorsHeaders(successResponse);

  } catch (error) {
    // Daha detaylı loglama için hatanın tamamını logla
    console.error("Worker'da Kritik Hata:", error.stack || error);
    const errorResponse = new Response(JSON.stringify({ error: "Çeviri işlemi sırasında sunucu hatası oluştu.", details: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
    return addCorsHeaders(errorResponse);
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  },
};