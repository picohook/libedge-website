// index.js — Cloudflare Worker Ana Dosyası
import { Counter } from './Counter.js';

export default {
  async fetch(request, env, ctx) {
    const method = request.method.toUpperCase();
    const origin = request.headers.get('Origin');

    // --- Güvenli CORS Alanları ---
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

    // --- Preflight (OPTIONS) ---
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // --- Sadece POST Kabul Edilir ---
    if (method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "text/plain" }
      });
    }

    try {
      const data = await request.json();
      const { page, action } = data;

      if (!page || !["increment", "get"].includes(action)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid request format." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Data Object (DO) instance oluştur ---
      const counterId = env.COUNTER.idFromName(page);
      const counterObject = env.COUNTER.get(counterId);

      // --- İstek DO'ya yönlendirilir ---
      const doRequest = new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, action })
      });

      const response = await counterObject.fetch(doRequest);

      // --- Yanıt DO'dan alınır ---
      const result = await response.text();

      return new Response(result, {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
};

// --- DO Sınıfını Dışa Aktar ---
export { Counter } from './Counter.js';
