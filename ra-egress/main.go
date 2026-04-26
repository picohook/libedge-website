// ra-egress/main.go
//
// Kurum-içi egress agent. Cloudflare Tunnel (cloudflared) container'ının
// ardında çalışır; Proxy Worker'dan gelen imzalı isteği doğrular,
// ALLOWED_HOST_REGEX'e uyuyorsa publisher'a forward eder, response'u
// streaming olarak geri döndürür.
//
// Tek binary, sıfır external dep (net/http, crypto/hmac standard lib yeterli).
//
// Build: CGO_ENABLED=0 go build -ldflags="-s -w" -o ra-egress .
// Image: ~10MB (alpine veya scratch base)

package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	sharedSecret     []byte
	allowedHostRegex *regexp.Regexp
	maxRequestBytes  int64 = 10 * 1024 * 1024 // 10MB default
	upstreamClient = &http.Client{
		// HTTP/2'yi devre dışı bırak: Go'nun HTTP/2 SETTINGS/HEADERS frame
		// sıralaması AWS WAF bot detection tarafından "non-browser" olarak
		// sınıflandırılıyor. HTTP/1.1 fingerprint daha nötr.
		Transport: &http.Transport{
			// HTTP/2 devre dışı — Go h2 fingerprint AWS WAF'ı tetikliyor.
			TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
			// IPv4 zorla — Docker container'ın default outbound IPv6 olabilir;
			// kurum IP'si IPv4 olduğundan tcp4 ile kurum IP'si garantilenir.
			DialContext: func(ctx context.Context, _, addr string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "tcp4", addr)
			},
		},
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Redirect'leri takip ETME — 302/301 response'u olduğu gibi
			// Proxy Worker'a döndür. Worker Location header'ı rewrite eder,
			// Set-Cookie'leri tarayıcıya iletir. ra-egress burada takip ederse
			// ara 302'deki Set-Cookie kaybolur (EMIS session cookie sorunu).
			return http.ErrUseLastResponse
		},
	}
)

func main() {
	secretStr := mustEnv("EGRESS_SHARED_SECRET")
	sharedSecret = []byte(secretStr)

	hostPattern := mustEnv("ALLOWED_HOST_REGEX")
	re, err := regexp.Compile(hostPattern)
	if err != nil {
		log.Fatalf("invalid ALLOWED_HOST_REGEX: %v", err)
	}
	allowedHostRegex = re

	if v := os.Getenv("MAX_REQUEST_BYTES"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err == nil && n > 0 {
			maxRequestBytes = n
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/proxy", handleProxy)

	addr := ":8080"
	if v := os.Getenv("LISTEN_ADDR"); v != "" {
		addr = v
	}
	log.Printf("ra-egress listening on %s, host regex: %s", addr, hostPattern)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func mustEnv(k string) string {
	v := os.Getenv(k)
	if v == "" {
		log.Fatalf("env %s required", k)
	}
	return v
}

// ──────────────────────────────────────────────────────────────────────────
// /health — cloudflared arkasında Worker'ın cron'u ping atar
// ──────────────────────────────────────────────────────────────────────────
func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","ts":%d}`, time.Now().Unix())
}

// ──────────────────────────────────────────────────────────────────────────
// /proxy — Worker'dan gelen imzalı proxy isteği
// ──────────────────────────────────────────────────────────────────────────
func handleProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	targetURL := r.Header.Get("X-RA-Target-URL")
	upstreamMethod := r.Header.Get("X-RA-Method")
	tsStr := r.Header.Get("X-RA-Timestamp")
	sigHex := r.Header.Get("X-RA-Signature")

	if targetURL == "" || upstreamMethod == "" || tsStr == "" || sigHex == "" {
		http.Error(w, "missing RA headers", http.StatusBadRequest)
		return
	}

	// Timestamp ±30sn
	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		http.Error(w, "bad timestamp", http.StatusBadRequest)
		return
	}
	now := time.Now().Unix()
	if ts < now-30 || ts > now+30 {
		http.Error(w, "timestamp skew", http.StatusUnauthorized)
		return
	}

	// Body oku (max limit)
	var bodyBytes []byte
	if r.Body != nil {
		limited := io.LimitReader(r.Body, maxRequestBytes+1)
		bodyBytes, err = io.ReadAll(limited)
		if err != nil {
			http.Error(w, "body read error", http.StatusBadRequest)
			return
		}
		if int64(len(bodyBytes)) > maxRequestBytes {
			http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
			return
		}
	}

	// Body hash
	bodyHash := ""
	if len(bodyBytes) > 0 {
		h := sha256.Sum256(bodyBytes)
		bodyHash = hex.EncodeToString(h[:])
	}

	// İmza doğrula
	msg := fmt.Sprintf("%s|%s|%d|%s", upstreamMethod, targetURL, ts, bodyHash)
	mac := hmac.New(sha256.New, sharedSecret)
	mac.Write([]byte(msg))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sigHex)) {
		http.Error(w, "bad signature", http.StatusUnauthorized)
		return
	}

	// Host allowlist — SSRF koruması, en kritik kontrol
	req, err := http.NewRequest(upstreamMethod, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, "bad target URL", http.StatusBadRequest)
		return
	}
	if !allowedHostRegex.MatchString(req.URL.Hostname()) {
		log.Printf("blocked host: %s", req.URL.Hostname())
		http.Error(w, "host not allowed", http.StatusForbidden)
		return
	}

	// RA-özgü header'ları filtrele; diğerlerini forward et
	for k, vs := range r.Header {
		if isRAHeader(k) {
			continue
		}
		if isHopByHopHeader(k) {
			continue
		}
		// IP-ifşa eden header'ları filtrele — JoVE kurum IP'sini (159.x.x.x)
		// görmeli; mobil/CF kaynak IP'yi değil.
		if isIPRevealingHeader(k) {
			continue
		}
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}

	// Host header target'a göre set
	req.Host = req.URL.Host

	// Upstream fetch
	upstreamStart := time.Now()
	resp, err := upstreamClient.Do(req)
	if err != nil {
		log.Printf("upstream error: %v", err)
		http.Error(w, "upstream unreachable", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	log.Printf("proxied %s %s → %d (%dms)", upstreamMethod, targetURL, resp.StatusCode, time.Since(upstreamStart).Milliseconds())

	// Response header'larını kopyala (hop-by-hop filtrele)
	for k, vs := range resp.Header {
		if isHopByHopHeader(k) {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	// Latency header (Worker tarafında metric için)
	w.Header().Set("X-RA-Upstream-Latency-Ms",
		strconv.FormatInt(time.Since(upstreamStart).Milliseconds(), 10))

	w.WriteHeader(resp.StatusCode)

	// Streaming body — Worker response'u chunk chunk Worker'a akıtır,
	// Worker HTMLRewriter'a vererek kullanıcıya stream eder.
	if _, err := io.Copy(w, resp.Body); err != nil {
		log.Printf("body copy error: %v", err)
	}
}

// ──────────────────────────────────────────────────────────────────────────
func isRAHeader(k string) bool {
	switch k {
	case "X-Ra-Target-Url", "X-Ra-Method", "X-Ra-Timestamp", "X-Ra-Signature",
		"X-Ra-Target-URL", "X-RA-Target-URL", "X-RA-Method", "X-RA-Timestamp", "X-RA-Signature":
		return true
	}
	return false
}

func isHopByHopHeader(k string) bool {
	// RFC 7230 section 6.1
	switch k {
	case "Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization",
		"TE", "Trailers", "Transfer-Encoding", "Upgrade", "Host":
		return true
	}
	return false
}

// isIPRevealingHeader — Cloudflare Workers veya ara proxy'lerin eklediği
// gerçek kullanıcı IP'sini ifşa eden header'ları filtreler.
// Bunlar JoVE'ye ulaşırsa JoVE mobil IP'yi görür ve kurumsal erişim vermez.
func isIPRevealingHeader(k string) bool {
	switch strings.ToLower(k) {
	case "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
		"x-real-ip", "true-client-ip",
		"cf-connecting-ip", "cf-connecting-ipv6",
		"cf-ipcountry", "cf-ray", "cf-visitor", "cf-worker",
		"cdn-loop", "x-cluster-client-ip":
		return true
	}
	return false
}
