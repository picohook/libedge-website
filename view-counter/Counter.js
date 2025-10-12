/**
 * Cloudflare Durable Object — View Counter
 * Tüm sayaç işlemlerinde tam tutarlılık (strong consistency) sağlar.
 */
export class Counter {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
    this.views = 0;
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      this.views = parseInt(await this.storage.get("view_count")) || 0;
      this.initialized = true;
    }
  }

  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      const data = await request.json();
      const { action } = data;

      if (!action) {
        return new Response(JSON.stringify({ error: "Missing 'action' parameter" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      await this.ensureInitialized();

      if (action === "get") {
        return new Response(JSON.stringify({ views: this.views }), {
          status: 200,
          headers: corsHeaders
        });
      }

      if (action === "increment") {
        this.views++;
        await this.storage.put("view_count", this.views);
        return new Response(JSON.stringify({ views: this.views }), {
          status: 200,
          headers: corsHeaders
        });
      }

      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: corsHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
}
