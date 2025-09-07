addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text");
  const target = url.searchParams.get("target");

  if (!text || !target) {
    return new Response(JSON.stringify({
      error: "Text or target param missing"
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 400
    });
  }

  const project_id = SA_PROJECT_ID;
  const sa_email = SA_CLIENT_EMAIL;
  const sa_private_key = SA_PRIVATE_KEY.replace(/\\n/g, '\n');

  // JWT oluşturma ve kimlik doğrulama
  const authUrl = 'https://www.googleapis.com/oauth2/v4/token';
  const claims = {
    iss: sa_email,
    scope: 'https://www.googleapis.com/auth/cloud-translation',
    aud: authUrl,
    exp: Math.floor(Date.now() / 1000) + 3600, // Token 1 saat geçerli
    iat: Math.floor(Date.now() / 1000)
  };

  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const toSign = btoa(JSON.stringify(jwtHeader)) + '.' + btoa(JSON.stringify(claims));

  // Kripto API'si ile imzalama
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    new TextEncoder().encode(sa_private_key), {
      name: 'RSASSA-PKCS1-v1_5',
      hash: {
        name: 'SHA-256'
      }
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(toSign)
  );

  const jwt = toSign + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));

  try {
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion': jwt
      })
    });
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Google Translate API çağrısı
    const translateUrl = `https://translation.googleapis.com/v2/projects/${project_id}/translateText`;
    const translateResponse = await fetch(translateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        q: [text],
        target: target
      })
    });

    const translateData = await translateResponse.json();

    if (translateData.error) {
      console.error("Translation API Error:", translateData.error);
      return new Response(JSON.stringify({
        error: translateData.error.message
      }), {
        headers: {
          'Content-Type': 'application/json'
        },
        status: translateData.error.code
      });
    }

    const translatedText = translateData.data.translations[0].translatedText;

    return new Response(JSON.stringify({
      data: {
        translations: [{
          translatedText: translatedText
        }]
      }
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error("Translation failed:", error);
    return new Response(JSON.stringify({
      error: "Translation failed"
    }), {
      headers: {
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
}