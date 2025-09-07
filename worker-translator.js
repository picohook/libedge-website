addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // ... (mevcut kodunuz) ...

  const url = new URL(request.url);
  const text = url.searchParams.get("text");
  const target = url.searchParams.get("target");

  if (!text || !target) {
    return new Response(JSON.stringify({ error: "Text or target param missing" }), {
      headers: {
        'Content-Type': 'application/json',
        // CORS hatasını çözmek için bu satırı ekleyin:
        'Access-Control-Allow-Origin': '*' 
      },
      status: 400
    });
  }

  // Burada Google Translate API'si ile ilgili kodunuz olacak.

  const translatedText = "Çevrilmiş Metin Örneği"; // Örnek metin

  const responseBody = {
    data: {
      translations: [{ translatedText: translatedText }]
    }
  };

  return new Response(JSON.stringify(responseBody), {
    headers: {
      'Content-Type': 'application/json',
      // CORS hatasını çözmek için bu satırı ekleyin:
      'Access-Control-Allow-Origin': '*' 
    },
    status: 200
  });
}