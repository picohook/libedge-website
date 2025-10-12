/**
 * Bu sınıf, Cloudflare Durable Object (DO) olarak görev yapar ve 
 * sayaç işlemlerinde tam tutarlılık (strong consistency) sağlar.
 */
export class Counter {
    constructor(state, env) {
        this.state = state;
        this.storage = this.state.storage; 
        this.counterKey = "view_count";
        this.views = 0;
        
        // DO yüklendiğinde asenkron olarak sayacı depolamadan oku
        this.initialize();
    }
    
    async initialize() {
        // Depolamada sayı string olarak saklandığından, okunan değeri sayıya çevir
        this.views = parseInt(await this.storage.get(this.counterKey)) || 0;
    }

    /**
     * Sayaç isteklerini işleyen metot
     */
    async fetch(request) {
        // CORS ayarlarınızı Worker'dan kopyalayın
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // Worker'daki ile eşleşmeli
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        };
        
        if (request.method === "OPTIONS") {
             return new Response(null, { status: 200, headers: corsHeaders });
        }
        
        // Sadece POST istekleri bekleniyor
        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
        }
        
        try {
            const data = await request.json();
            const { action } = data;
            
            if (!action) {
                return new Response(JSON.stringify({ error: "Missing 'action' parameter" }), { status: 400, headers: corsHeaders });
            }
            
            let responseBody = {};

            if (action === 'get') {
                // Anlık değeri döndür
                responseBody = { views: this.views };

            } else if (action === 'increment') {
                // Sayacı atomik olarak artır
                this.views = this.views + 1;
                
                // Kalıcı depolamaya yeni değeri yaz
                // Bu yazma işlemi Durable Object içinde garanti altına alınmıştır.
                await this.storage.put(this.counterKey, this.views);

                responseBody = { views: this.views };
            } else {
                 return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
            }

            return new Response(JSON.stringify(responseBody), {
                status: 200,
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