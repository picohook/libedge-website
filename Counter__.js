/**
 * Bu sınıf, Cloudflare Durable Object (DO) olarak görev yapar.
 * Her bir "page" ID'si için tekil bir örnek oluşturularak 
 * sayaç işlemlerinde tam tutarlılık (strong consistency) sağlar.
 */
export class Counter {
    constructor(state, env) {
        this.state = state;
        // Bu, Durable Object'in içindeki kalıcı depolama alanıdır.
        this.storage = this.state.storage; 
        
        // Sayaç değerini depolama alanından okur.
        // Bu, DO yüklendiğinde bir kez yapılır.
        this.counterKey = "view_count";
        this.views = 0;
        
        // Bir sonraki adımdaki asenkron okumayı başlat.
        this.initialize();
    }
    
    // Asenkron olarak depolama alanından değeri okuyan bir metot
    async initialize() {
        this.views = (await this.storage.get(this.counterKey)) || 0;
    }

    /**
     * Gelen isteği işleyen ana metot.
     * @param {Request} request Worker'dan gelen istek nesnesi.
     * @returns {Response} İstemciye geri gönderilecek yanıt.
     */
    async fetch(request) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // Worker'daki ile eşleşmeli
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
        };
        
        // Orijinal Worker'daki CORS mantığını basitleştirilmiş haliyle buraya taşıyalım
        if (request.method === "OPTIONS") {
             return new Response(null, { status: 200, headers: corsHeaders });
        }
        
        // POST isteği bekleniyor
        if (request.method !== "POST") {
            return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
        }
        
        try {
            // Worker'dan gelen body'yi okuyoruz
            const data = await request.json();
            const { action } = data;
            
            if (!action) {
                return new Response(JSON.stringify({ error: "Missing 'action' parameter" }), { status: 400, headers: corsHeaders });
            }
            
            let responseBody = {};

            if (action === 'get') {
                // Sayacı depolamadan oku ve döndür
                responseBody = { views: this.views };

            } else if (action === 'increment') {
                // Sayacı atomik olarak artır ve depolamaya kaydet
                this.views = this.views + 1;
                
                // setAlarm ile sayıyı kalıcı olarak diske kaydet
                // Bu, her istekte diske yazma maliyetinden kaçınmak için optimize edilmiş bir yoldur.
                // Basit bir sayaç için her seferinde 'put' da kullanabilirsiniz: 
                // await this.storage.put(this.counterKey, this.views);
                
                // NOT: Basit bir sayaç için anlık tutarlılık önemlidir, bu yüzden her seferinde 'put' kullanmak en doğrusudur.
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