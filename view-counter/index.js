// Worker'ın ana dosyası

export default {
  async fetch(request, env, ctx) {
    const method = request.method.toUpperCase();
    const origin = request.headers.get('Origin');
    
    // CORS/Güvenlik ayarlarınızı orijinal index.js'ten kopyalayın
    const allowedOrigins = [
      'https://libedge-website.pages.dev',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    const isOriginAllowed = allowedOrigins.includes(origin);
    const corsOrigin = isOriginAllowed ? origin : allowedOrigins[0];

    const corsHeaders = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        const data = await request.json();
        
        const { page, action } = data;
        
        if (page && (action === 'increment' || action === 'get')) {
            // Durable Object'e yönlendir:
            // env.COUNTER, Cloudflare panosunda tanımlayacağınız binding ismidir.
            const counterId = env.COUNTER.idFromName(page); 
            const counterObject = env.COUNTER.get(counterId);
            
            // İstek, Counter.js içindeki DO'ya iletilir 
            return await counterObject.fetch(request);
        }

        // Sayaç isteği değilse, hata döndür
        return new Response(JSON.stringify({ success: false, error: "Invalid request format. Only counter requests are supported." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
        
      } catch (err) {
        // Hata yakalama
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Method not allowed", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });
  }
};

// Bu, Worker'ın ana dosyası olduğu için, DO sınıfını da buradan dışa aktarmalıyız.
export { Counter } from './Counter.js';