// ra-egress/main.go
//
// Kurum-içi egress agent. Cloudflare Tunnel (cloudflared) container'ının
// ardında çalışır; Proxy Worker'dan gelen imzalı isteği doğrular,
// ALLOWED_HOST_REGEX'e uyuyorsa publisher'a forward eder, response'u
// streaming olarak geri döndürür.
//
// Build: CGO_ENABLED=0 go build -ldflags="-s -w" -o ra-egress .
// Image: ~10MB (alpine veya scratch base)
//
// TLS fingerprint: utls ile Chrome JA3 taklit edilir; Cloudflare'in
// Go net/tls bot tespitini (ACS gibi CF-korumalı yayıncılarda) aşmak için.

package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	utls "github.com/refraction-networking/utls"
	"golang.org/x/net/http2"
)

var (
	sharedSecret     []byte
	allowedHostRegex *regexp.Regexp
	maxRequestBytes  int64 = 10 * 1024 * 1024 // 10MB default

	// İki ayrı upstream client:
	//   autoClient — uTLS Chrome JA3 + HTTP/2 (h2+http/1.1 ALPN). Cloudflare
	//                bot detection HTTP/2 fingerprint bekliyor; HTTP/1.1 forced
	//                geldiğinde otomatik bot diye işaretliyor (ACS, AR, WoS).
	//   h1Client   — uTLS Chrome JA3 + sadece HTTP/1.1 ALPN. AWS WAF (JoVE),
	//                Go HTTP/2 SETTINGS frame fingerprint'ini bot diye sınıflandırıyor.
	// forceH1Regex'e göre per-host seçim yapılır (default: jove.com varyantları).
	autoClient   *http.Client
	h1Client     *http.Client
	forceH1Regex *regexp.Regexp

	// Dinamik host listesi — API'den 5 dakikada bir yenilenir.
	// Boşken sadece allowedHostRegex kullanılır (fallback).
	dynamicHostsMu sync.RWMutex
	dynamicHosts   map[string]bool
)

// HTTP1_FORCE_HOSTS_REGEX default — JoVE'un AWS WAF'ı ve sso.cas.org'un
// Imperva/Incapsula WAF'ı Go HTTP/2 fingerprint'ini bot diye sınıflandırıyor
// (sso.cas.org'da angular.min.js / jquery.slim.min.js / bootstrap.min.css gibi
// statik asset'ler 500 dönüyor + her request 13 saniye yavaşlıyordu). Cloudflare-
// fronted publisher'lar (ACS, AR, WoS, IOP, scifinder-n, vb.) HTTP/2'yi gerektiriyor;
// bu host'ları HTTP/1.1'e zorlamak diğerlerini kırmıyor — regex sadece tam match
// olduğu için scifinder-n.cas.org gibi kardeş subdomain'ler etkilenmez.
const defaultForceH1Regex = `^(([a-z0-9-]+\.)*jove\.com|sso\.cas\.org)$`

// noFollowRedirect — 302/301 response'u olduğu gibi Proxy Worker'a döndür.
// Worker Location header'ı rewrite eder, Set-Cookie'leri tarayıcıya iletir.
// ra-egress burada takip ederse ara 302'deki Set-Cookie kaybolur (EMIS sorunu).
func noFollowRedirect(_ *http.Request, _ []*http.Request) error {
	return http.ErrUseLastResponse
}

// buildAutoClient — uTLS Chrome JA3 + ALPN[h2,http/1.1] üzerinden HTTP/2.
//
// Neden net/http Transport DEĞİL?
//   net/http Transport'un h2 upgrade'i `TLSNextProto["h2"]` üzerinden çalışıyor
//   ve handler imzası `func(string, *tls.Conn) http.RoundTripper` — yani
//   `*crypto/tls.Conn` bekliyor. Bizim DialTLSContext `*utls.UConn` döndürüyor;
//   tip uyumsuz, h2 handler hiç çağrılmıyor → server h2 negotiate ettiği için h2
//   frame bekliyor ama transport HTTP/1.1 metni gönderiyor → connection close.
//   Cf: https://github.com/refraction-networking/utls/issues/16
//
// Çözüm: golang.org/x/net/http2 Transport'u DOĞRUDAN RoundTripper olarak kullan.
//   http2.Transport.DialTLSContext herhangi bir net.Conn'u kabul ediyor; utls
//   UConn'u doğrudan veriyoruz. ALPN ile h2 negotiate edilmediyse erken hata
//   döner — sessizce protokol uyumsuzluğuna düşmek yerine.
func buildAutoClient() *http.Client {
	return &http.Client{
		Transport: &http2.Transport{
			DialTLSContext: func(ctx context.Context, _, addr string, _ *tls.Config) (net.Conn, error) {
				conn, err := dialTLSChrome(ctx, addr, []string{"h2", "http/1.1"})
				if err != nil {
					return nil, err
				}
				if uc, ok := conn.(*utls.UConn); ok {
					proto := uc.ConnectionState().NegotiatedProtocol
					if proto != "h2" {
						_ = conn.Close()
						return nil, fmt.Errorf("h2 not negotiated (got %q)", proto)
					}
				}
				// Chrome HTTP/2 SETTINGS_INITIAL_WINDOW_SIZE patch.
				// Go'nun http2.Transport'u INITIAL_WINDOW_SIZE'ı public API üzerinden
				// ayarlamaya izin vermiyor. İlk Write() çağrısında SETTINGS frame'ini
				// intercept edip Chrome değeri olan 6291456 (0x00600000) ile patch
				// ediyoruz. Böylece JA3 (utls) + SETTINGS fingerprint tam Chrome oluyor.
				return &chromeSettingsConn{Conn: conn}, nil
			},
			// Chrome HTTP/2 SETTINGS fingerprint (public API ile ayarlanabilenler).
			MaxDecoderHeaderTableSize: 65536,  // SETTINGS_HEADER_TABLE_SIZE
			MaxHeaderListSize:         262144, // SETTINGS_MAX_HEADER_LIST_SIZE
		},
		Timeout:       30 * time.Second,
		CheckRedirect: noFollowRedirect,
	}
}

// h2ClientPreface — RFC 7540 §3.5 client connection preface (24 bytes).
const h2ClientPreface = "PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"

// chromeSettingsConn patches the initial HTTP/2 SETTINGS frame written by
// http2.Transport so that SETTINGS_INITIAL_WINDOW_SIZE matches Chrome's value
// (6291456) instead of Go's default (65535).
type chromeSettingsConn struct {
	net.Conn
	patched bool
}

func (c *chromeSettingsConn) Write(b []byte) (int, error) {
	if !c.patched {
		c.patched = true
		patched := patchH2InitialWindowSize(b)
		if patched != nil {
			n, err := c.Conn.Write(patched)
			if err != nil {
				return n, err
			}
			return len(b), nil // callers expect len(b) on success
		}
	}
	return c.Conn.Write(b)
}

// patchH2InitialWindowSize rewrites the HTTP/2 SETTINGS frame (immediately
// after the client connection preface) so that its payload exactly matches
// Chrome's four parameters in Chrome's order:
//
//	ID=1  HEADER_TABLE_SIZE      = 65536
//	ID=2  ENABLE_PUSH            = 0
//	ID=4  INITIAL_WINDOW_SIZE    = 6291456
//	ID=6  MAX_HEADER_LIST_SIZE   = 262144
//
// It also patches the WINDOW_UPDATE frame that follows (type=0x08) to use
// Chrome's connection-level increment of 15663105 instead of Go's default.
// Returns nil if the input cannot be parsed as expected.
func patchH2InitialWindowSize(data []byte) []byte {
	// Chrome's exact SETTINGS payload: 4 parameters × 6 bytes = 24 bytes.
	chromeSettings := []byte{
		0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // ID=1 HEADER_TABLE_SIZE      = 65536
		0x00, 0x02, 0x00, 0x00, 0x00, 0x00, // ID=2 ENABLE_PUSH            = 0
		0x00, 0x04, 0x00, 0x60, 0x00, 0x00, // ID=4 INITIAL_WINDOW_SIZE    = 6291456
		0x00, 0x06, 0x00, 0x04, 0x00, 0x00, // ID=6 MAX_HEADER_LIST_SIZE   = 262144
	}
	const chromeWindowUpdateIncrement uint32 = 15663105 // 0x00EF0001

	prefaceLen := len(h2ClientPreface)
	if len(data) < prefaceLen+9 {
		return nil
	}
	if string(data[:prefaceLen]) != h2ClientPreface {
		return nil
	}

	// SETTINGS frame header starts immediately after the preface.
	pos := prefaceLen
	origFrameLen := int(data[pos])<<16 | int(data[pos+1])<<8 | int(data[pos+2])
	frameType := data[pos+3]
	frameFlags := data[pos+4]
	if frameType != 0x04 || frameFlags != 0x00 { // must be SETTINGS, not ACK
		return nil
	}
	origPayloadStart := pos + 9
	origPayloadEnd := origPayloadStart + origFrameLen
	if origPayloadEnd > len(data) {
		return nil
	}

	// Rebuild: preface + new SETTINGS frame header + Chrome payload + remainder.
	newPayloadLen := len(chromeSettings) // 24
	out := make([]byte, 0, prefaceLen+9+newPayloadLen+(len(data)-origPayloadEnd))
	out = append(out, data[:pos]...)                                // preface (24 bytes)
	out = append(out, byte(newPayloadLen>>16), byte(newPayloadLen>>8), byte(newPayloadLen)) // new 3-byte length
	out = append(out, data[pos+3:origPayloadStart]...)              // type(0x04), flags(0x00), stream ID (4 bytes)
	out = append(out, chromeSettings...)                            // Chrome's exact 4-param payload
	remainder := data[origPayloadEnd:]
	out = append(out, remainder...)

	// Patch the WINDOW_UPDATE frame (type=0x08) if present in the remainder.
	// The remainder offset within out starts at: prefaceLen + 9 + newPayloadLen.
	remStart := prefaceLen + 9 + newPayloadLen
	for i := remStart; i+13 <= len(out); i++ {
		// Frame header: 3-byte length, 1-byte type, 1-byte flags, 4-byte stream ID.
		wuLen := int(out[i])<<16 | int(out[i+1])<<8 | int(out[i+2])
		wuType := out[i+3]
		if wuType == 0x08 && wuLen == 4 {
			// WINDOW_UPDATE payload is 4 bytes starting at i+9.
			if i+9+4 <= len(out) {
				v := chromeWindowUpdateIncrement
				out[i+9] = byte(v >> 24)
				out[i+10] = byte(v >> 16)
				out[i+11] = byte(v >> 8)
				out[i+12] = byte(v)
			}
			break
		}
		// Skip non-matching frames: advance by full frame size (9-byte header + payload).
		if wuLen >= 0 && i+9+wuLen <= len(out) {
			i += 9 + wuLen - 1 // -1 because loop does i++
		} else {
			break
		}
	}

	return out
}

// buildH1Client — uTLS Chrome JA3 + ALPN[http/1.1] sadece.
//   AWS WAF (JoVE) Go HTTP/2 SETTINGS frame sıralamasını bot diye işaretliyor.
//   TLSNextProto boş map ile h2 negotiation tamamen kapatılıyor (çift güvence).
func buildH1Client() *http.Client {
	return &http.Client{
		Transport: &http.Transport{
			DialTLSContext: dialTLSChromeH1,
			DialContext: func(ctx context.Context, _, addr string) (net.Conn, error) {
				return (&net.Dialer{}).DialContext(ctx, "tcp4", addr)
			},
			TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
		},
		Timeout:       30 * time.Second,
		CheckRedirect: noFollowRedirect,
	}
}

// selectClient — host'a göre h1 zorla mı, otomatik (h2 öncelikli) mi seç.
func selectClient(hostname string) *http.Client {
	if forceH1Regex != nil && forceH1Regex.MatchString(strings.ToLower(hostname)) {
		return h1Client
	}
	return autoClient
}

// dialTLSChromeH1 — Chrome JA3 + ALPN[http/1.1].
func dialTLSChromeH1(ctx context.Context, _, addr string) (net.Conn, error) {
	return dialTLSChrome(ctx, addr, []string{"http/1.1"})
}

// dialTLSChrome — Chrome TLS fingerprint + IPv4 + verilen ALPN listesi.
func dialTLSChrome(ctx context.Context, addr string, alpnProtocols []string) (net.Conn, error) {
	tcpConn, err := (&net.Dialer{}).DialContext(ctx, "tcp4", addr)
	if err != nil {
		return nil, err
	}

	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		tcpConn.Close()
		return nil, err
	}

	spec, err := utls.UTLSIdToSpec(utls.HelloChrome_Auto)
	if err != nil {
		tcpConn.Close()
		return nil, fmt.Errorf("utls spec: %w", err)
	}
	for i, ext := range spec.Extensions {
		if alpn, ok := ext.(*utls.ALPNExtension); ok {
			alpn.AlpnProtocols = alpnProtocols
			spec.Extensions[i] = alpn
			break
		}
	}

	uconn := utls.UClient(tcpConn, &utls.Config{ServerName: host}, utls.HelloCustom)
	if err := uconn.ApplyPreset(&spec); err != nil {
		tcpConn.Close()
		return nil, fmt.Errorf("utls preset: %w", err)
	}
	if err := uconn.HandshakeContext(ctx); err != nil {
		tcpConn.Close()
		return nil, fmt.Errorf("utls handshake: %w", err)
	}
	return uconn, nil
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--healthcheck" {
		runHealthcheck()
		return
	}

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

	forceH1Pattern := os.Getenv("HTTP1_FORCE_HOSTS_REGEX")
	if forceH1Pattern == "" {
		forceH1Pattern = defaultForceH1Regex
	}
	h1re, err := regexp.Compile(forceH1Pattern)
	if err != nil {
		log.Fatalf("invalid HTTP1_FORCE_HOSTS_REGEX: %v", err)
	}
	forceH1Regex = h1re

	autoClient = buildAutoClient()
	h1Client = buildH1Client()

	apiURL := os.Getenv("LIBEDGE_API_URL")
	serviceKey := os.Getenv("LIBEDGE_SERVICE_KEY")

	if apiURL != "" && serviceKey != "" {
		// İlk yükleme — agent açılırken host listesini hemen çek
		if err := refreshDynamicHosts(apiURL, serviceKey); err != nil {
			log.Printf("initial host refresh failed (fallback to regex): %v", err)
		}
		// 5 dakikada bir yenile
		go func() {
			ticker := time.NewTicker(5 * time.Minute)
			defer ticker.Stop()
			for range ticker.C {
				if err := refreshDynamicHosts(apiURL, serviceKey); err != nil {
					log.Printf("host refresh failed: %v", err)
				}
			}
		}()
	} else {
		log.Printf("LIBEDGE_API_URL / LIBEDGE_SERVICE_KEY not set — using ALLOWED_HOST_REGEX only")
	}

	browserURL, _ := url.Parse("http://ra-browser:8081")
	if v := os.Getenv("RA_BROWSER_URL"); v != "" {
		if parsed, err := url.Parse(v); err == nil {
			browserURL = parsed
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/proxy", handleProxy)
	mux.HandleFunc("/browser-proxy", handleBrowserProxy(browserURL))
	mux.HandleFunc("/", handleNotFound)

	addr := ":8080"
	if v := os.Getenv("LISTEN_ADDR"); v != "" {
		addr = v
	}
	log.Printf("ra-egress listening on %s, host regex: %s", addr, hostPattern)
	log.Printf("http/1.1 force regex: %s", forceH1Pattern)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func runHealthcheck() {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:8080/health")
	if err != nil {
		log.Printf("healthcheck failed: %v", err)
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		log.Printf("healthcheck status: %d", resp.StatusCode)
		os.Exit(1)
	}
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
// refreshDynamicHosts — /api/ra/egress/allowed-hosts endpoint'inden host listesini çeker.
func refreshDynamicHosts(apiURL, serviceKey string) error {
	url := strings.TrimRight(apiURL, "/") + "/api/ra/egress/allowed-hosts"
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("allowed-hosts returned %d", resp.StatusCode)
	}

	var body struct {
		Hosts []string `json:"hosts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return err
	}

	hosts := make(map[string]bool, len(body.Hosts))
	for _, h := range body.Hosts {
		if h != "" {
			hosts[strings.ToLower(h)] = true
		}
	}

	dynamicHostsMu.Lock()
	dynamicHosts = hosts
	dynamicHostsMu.Unlock()

	log.Printf("dynamic host list refreshed: %d hosts", len(hosts))
	return nil
}

// isHostAllowed — regex VEYA dinamik listede varsa true.
// İkisi birbirini devre dışı bırakmaz; her ikisi de her zaman kontrol edilir.
func isHostAllowed(hostname string) bool {
	if allowedHostRegex != nil && allowedHostRegex.MatchString(hostname) {
		return true
	}
	dynamicHostsMu.RLock()
	allowed := dynamicHosts[strings.ToLower(hostname)]
	dynamicHostsMu.RUnlock()
	return allowed
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, `{"status":"ok","ts":%d}`, time.Now().Unix())
}

func handleNotFound(w http.ResponseWriter, r *http.Request) {
	log.Printf("not found %s %s host=%s ua=%q", r.Method, r.URL.String(), r.Host, r.UserAgent())
	http.NotFound(w, r)
}

// ──────────────────────────────────────────────────────────────────────────
// raRequestError — shared HMAC validation result
// ──────────────────────────────────────────────────────────────────────────

type raValidationResult struct {
	targetURL      string
	upstreamMethod string
	bodyBytes      []byte
}

// validateRARequest extracts and validates the RA HMAC headers from an
// incoming Worker request. Returns the parsed fields on success, or writes
// an HTTP error to w and returns nil.
//
// bodyBytes is read and returned so the caller can use it without re-reading
// (r.Body is consumed). For GET requests bodyBytes will be empty.
func validateRARequest(w http.ResponseWriter, r *http.Request) *raValidationResult {
	targetURL      := r.Header.Get("X-RA-Target-URL")
	upstreamMethod := r.Header.Get("X-RA-Method")
	tsStr          := r.Header.Get("X-RA-Timestamp")
	sigHex         := r.Header.Get("X-RA-Signature")

	if targetURL == "" || upstreamMethod == "" || tsStr == "" || sigHex == "" {
		http.Error(w, "missing RA headers", http.StatusBadRequest)
		return nil
	}

	ts, err := strconv.ParseInt(tsStr, 10, 64)
	if err != nil {
		http.Error(w, "bad timestamp", http.StatusBadRequest)
		return nil
	}
	now := time.Now().Unix()
	if ts < now-30 || ts > now+30 {
		http.Error(w, "timestamp skew", http.StatusUnauthorized)
		return nil
	}

	// Read body (may be empty for GET)
	var bodyBytes []byte
	if r.Body != nil {
		limited := io.LimitReader(r.Body, maxRequestBytes+1)
		bodyBytes, err = io.ReadAll(limited)
		if err != nil {
			http.Error(w, "body read error", http.StatusBadRequest)
			return nil
		}
		if int64(len(bodyBytes)) > maxRequestBytes {
			http.Error(w, "request too large", http.StatusRequestEntityTooLarge)
			return nil
		}
	}

	// Body hash
	bodyHash := ""
	if len(bodyBytes) > 0 {
		h := sha256.Sum256(bodyBytes)
		bodyHash = hex.EncodeToString(h[:])
	}

	// Verify HMAC
	msg := fmt.Sprintf("%s|%s|%d|%s", upstreamMethod, targetURL, ts, bodyHash)
	mac := hmac.New(sha256.New, sharedSecret)
	mac.Write([]byte(msg))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(sigHex)) {
		http.Error(w, "bad signature", http.StatusUnauthorized)
		return nil
	}

	return &raValidationResult{
		targetURL:      targetURL,
		upstreamMethod: upstreamMethod,
		bodyBytes:      bodyBytes,
	}
}

// ──────────────────────────────────────────────────────────────────────────
// /browser-proxy — pass-through to ra-browser container
// ──────────────────────────────────────────────────────────────────────────

// handleBrowserProxy validates the HMAC-signed request from the Worker, then
// forwards it verbatim to the ra-browser container at /proxy. ra-browser
// validates the same HMAC independently using the shared secret.
//
// The path rewrite: /browser-proxy → /proxy (ra-browser's endpoint).
func handleBrowserProxy(browserBaseURL *url.URL) http.HandlerFunc {
	proxy := httputil.NewSingleHostReverseProxy(browserBaseURL)

	// Rewrite /browser-proxy to /proxy before forwarding to ra-browser.
	origDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		origDirector(req)
		req.URL.Path = "/proxy"
		req.URL.RawPath = "/proxy"
		req.Host = browserBaseURL.Host
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("browser-proxy forward error: %v", err)
		http.Error(w, "ra-browser unreachable", http.StatusBadGateway)
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Validate HMAC before forwarding — SSRF and replay protection.
		// We must validate here so ra-egress does not blindly forward
		// arbitrary unsigned requests to the internal ra-browser container.
		result := validateRARequest(w, r)
		if result == nil {
			return // validateRARequest already wrote the error response
		}

		// Reconstruct the body reader for the reverse proxy (r.Body was consumed).
		r.Body = io.NopCloser(bytes.NewReader(result.bodyBytes))
		r.ContentLength = int64(len(result.bodyBytes))

		log.Printf("browser-proxy forwarding: %s %s → ra-browser:8081/proxy",
			result.upstreamMethod, result.targetURL)

		proxy.ServeHTTP(w, r)
	}
}

// ──────────────────────────────────────────────────────────────────────────
// /proxy — Worker'dan gelen imzalı proxy isteği
// ──────────────────────────────────────────────────────────────────────────
func handleProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Validate HMAC signature and read body using shared helper.
	validated := validateRARequest(w, r)
	if validated == nil {
		return
	}
	targetURL := validated.targetURL
	upstreamMethod := validated.upstreamMethod
	bodyBytes := validated.bodyBytes

	// Host allowlist — SSRF koruması, en kritik kontrol
	req, err := http.NewRequest(upstreamMethod, targetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		http.Error(w, "bad target URL", http.StatusBadRequest)
		return
	}
	if !isHostAllowed(req.URL.Hostname()) {
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

	// Upstream fetch — host'a göre HTTP/2 (default) veya HTTP/1.1 (JoVE vb.) seç
	client := selectClient(req.URL.Hostname())
	upstreamStart := time.Now()
	resp, err := client.Do(req)
	if err != nil && client != h1Client && isH2NotNegotiatedError(err) {
		log.Printf("upstream h2 unavailable, retrying h1: %s", targetURL)
		retryReq, retryErr := cloneUpstreamRequest(req, bodyBytes)
		if retryErr == nil {
			resp, err = h1Client.Do(retryReq)
		} else {
			err = retryErr
		}
	}
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

func isH2NotNegotiatedError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "h2 not negotiated")
}

func cloneUpstreamRequest(src *http.Request, bodyBytes []byte) (*http.Request, error) {
	req, err := http.NewRequest(src.Method, src.URL.String(), bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header = src.Header.Clone()
	req.Host = src.Host
	return req, nil
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
