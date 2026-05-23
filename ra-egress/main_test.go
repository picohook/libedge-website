package main

import (
	"bytes"
	"encoding/binary"
	"net"
	"net/http"
	"regexp"
	"testing"
	"time"

	"golang.org/x/net/http2"
)

// selectClient host'a göre h1Client mı autoClient mı seçiyor — regression koruması.
//
// Bug: 8a24d38 commit'i AWS WAF'ı (JoVE) aşmak için TÜM publisher'lar için
// HTTP/2'yi kapattı. Cloudflare-fronted publisher'lar (ACS, AR, WoS) HTTP/2
// fingerprint bekliyor, HTTP/1.1 forced gelirse bot diye 403 veriyor.
//
// Fix: forceH1Regex sadece bot-aware WAF arkasındaki host'lar (JoVE = AWS WAF,
// sso.cas.org = Imperva/Incapsula) için match etsin; kalan tümü autoClient
// (HTTP/2 öncelikli) ile gitsin. scifinder-n.cas.org gibi kardeş subdomain'ler
// regex tam match olduğu için ETKİLENMEZ — h2 ile devam eder.
func TestSelectClient_DefaultBotWAFHostsForcedToH1(t *testing.T) {
	autoClient = &http.Client{}
	h1Client = &http.Client{}
	forceH1Regex = regexp.MustCompile(defaultForceH1Regex)

	cases := []struct {
		host    string
		wantH1  bool
		comment string
	}{
		{"jove.com", true, "JoVE root → AWS WAF, force HTTP/1.1"},
		{"www.jove.com", true, "JoVE www subdomain"},
		{"player.jove.com", true, "JoVE player subdomain"},
		{"cdn.jove.com", true, "JoVE CDN"},
		{"assets.jove.com", true, "JoVE assets"},
		{"sso.cas.org", true, "CAS SSO → Imperva, force HTTP/1.1"},
		{"SSO.CAS.ORG", true, "CAS SSO case-insensitive"},
		{"scifinder-n.cas.org", false, "SciFinder → Cloudflare, HTTP/2 (sibling of sso.cas.org)"},
		{"cas.org", false, "CAS root → Cloudflare, must NOT match (only sso.cas.org)"},
		{"www.cas.org", false, "CAS www → Cloudflare"},
		{"pubs.acs.org", false, "ACS → Cloudflare, HTTP/2 needed"},
		{"www.annualreviews.org", false, "Annual Reviews → Cloudflare"},
		{"www.webofscience.com", false, "Web of Science → Cloudflare"},
		{"www.nature.com", false, "Nature"},
		{"ieeexplore.ieee.org", false, "IEEE Xplore"},
		{"link.springer.com", false, "Springer Link"},
		{"onlinelibrary.wiley.com", false, "Wiley"},
		{"www.emis.com", false, "EMIS"},
		{"jovexyz.com", false, "Lookalike host — must NOT match"},
		{"notjove.com", false, "Suffix-only lookalike — must NOT match"},
		{"WWW.JOVE.COM", true, "Case-insensitive match"},
	}
	for _, c := range cases {
		t.Run(c.host, func(t *testing.T) {
			got := selectClient(c.host)
			isH1 := got == h1Client
			if isH1 != c.wantH1 {
				t.Fatalf("%s: wantH1=%v gotH1=%v (%s)", c.host, c.wantH1, isH1, c.comment)
			}
		})
	}
}

// Custom regex env override → JoVE yanı sıra başka bir AWS WAF host'u eklenirse.
func TestSelectClient_CustomRegex(t *testing.T) {
	autoClient = &http.Client{}
	h1Client = &http.Client{}
	forceH1Regex = regexp.MustCompile(`^([a-z0-9-]+\.)*(jove|some-aws-host)\.com$`)

	cases := map[string]bool{
		"www.jove.com":          true,
		"www.some-aws-host.com": true,
		"pubs.acs.org":          false,
	}
	for host, wantH1 := range cases {
		t.Run(host, func(t *testing.T) {
			got := selectClient(host)
			if (got == h1Client) != wantH1 {
				t.Fatalf("%s: wantH1=%v", host, wantH1)
			}
		})
	}
}

// Empty regex (compile bypass) → hep autoClient.
func TestSelectClient_NoRegexMeansAuto(t *testing.T) {
	autoClient = &http.Client{}
	h1Client = &http.Client{}
	forceH1Regex = nil
	if got := selectClient("www.jove.com"); got != autoClient {
		t.Fatalf("nil regex: expected autoClient")
	}
}

// Regex compile health: default regex'in geçerli olduğunu doğrula.
func TestDefaultForceH1Regex_Compiles(t *testing.T) {
	if _, err := regexp.Compile(defaultForceH1Regex); err != nil {
		t.Fatalf("defaultForceH1Regex compile: %v", err)
	}
}

func TestIsHostAllowed_DynamicWildcardSuffixes(t *testing.T) {
	allowedHostRegex = nil
	dynamicHostsMu.Lock()
	dynamicHosts = map[string]bool{"www.sciencedirect.com": true}
	dynamicHostWildcards = []string{"els-cdn.com"}
	dynamicHostsMu.Unlock()
	t.Cleanup(func() {
		dynamicHostsMu.Lock()
		dynamicHosts = nil
		dynamicHostWildcards = nil
		dynamicHostsMu.Unlock()
	})

	cases := map[string]bool{
		"www.sciencedirect.com": true,
		"ars.els-cdn.com":       true,
		"cdn.els-cdn.com":       true,
		"els-cdn.com":           true,
		"notels-cdn.com":        false,
		"els-cdn.com.evil.test": false,
	}
	for host, want := range cases {
		t.Run(host, func(t *testing.T) {
			if got := isHostAllowed(host); got != want {
				t.Fatalf("isHostAllowed(%q)=%v, want %v", host, got, want)
			}
		})
	}
}

// autoClient'ın transport'u *http2.Transport olmalı — net/http Transport DEĞİL.
//
// Regression korumas: net/http Transport + http2.ConfigureTransport kombinasyonu
// utls UConn ile çalışmıyor (TLSNextProto["h2"] handler *crypto/tls.Conn bekliyor,
// biz *utls.UConn veriyoruz → h2 upgrade asla tetiklenmez, server h2 frame
// beklerken biz HTTP/1.1 metni gönderiyoruz → connection close).
//
// Çözüm: doğrudan *http2.Transport. Bu test yanlışlıkla http.Transport'a dönülmesini
// engelliyor.
func TestAutoClient_UsesHTTP2Transport(t *testing.T) {
	c := buildAutoClient()
	if _, ok := c.Transport.(*http2.Transport); !ok {
		t.Fatalf("autoClient transport: want *http2.Transport, got %T", c.Transport)
	}
}

// h1Client'ın transport'u *http.Transport olmalı (HTTP/2 negotiation kapalı).
func TestH1Client_UsesHTTPTransport(t *testing.T) {
	c := buildH1Client()
	tr, ok := c.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("h1Client transport: want *http.Transport, got %T", c.Transport)
	}
	// TLSNextProto boş olmalı (h2 upgrade kapalı).
	if tr.TLSNextProto == nil {
		t.Fatalf("h1Client TLSNextProto: nil — h2 negotiation will leak")
	}
	if _, hasH2 := tr.TLSNextProto["h2"]; hasH2 {
		t.Fatalf("h1Client TLSNextProto: h2 handler present — should be empty map")
	}
}

// ──────────────────────────────────────────────────────────────────────────
// patchH2InitialWindowSize — Chrome H2 fingerprint patch tests
// ──────────────────────────────────────────────────────────────────────────

// buildFakeH2Write constructs a minimal HTTP/2 client connection preface
// followed by a SETTINGS frame carrying the given settings pairs, and
// optionally a WINDOW_UPDATE frame with the given increment.
func buildFakeH2Write(settings [][2]uint32, windowIncrement uint32, includeWindowUpdate bool) []byte {
	var buf bytes.Buffer
	buf.WriteString(h2ClientPreface)

	// SETTINGS payload: each entry is 6 bytes (2-byte ID + 4-byte value).
	payload := make([]byte, len(settings)*6)
	for i, kv := range settings {
		binary.BigEndian.PutUint16(payload[i*6:], uint16(kv[0]))
		binary.BigEndian.PutUint32(payload[i*6+2:], kv[1])
	}
	// SETTINGS frame header: 3-byte length, type=0x04, flags=0x00, 4-byte stream ID=0.
	hdr := make([]byte, 9)
	hdr[0] = byte(len(payload) >> 16)
	hdr[1] = byte(len(payload) >> 8)
	hdr[2] = byte(len(payload))
	hdr[3] = 0x04 // SETTINGS
	hdr[4] = 0x00 // no flags
	// hdr[5..8] = stream ID 0 (already zero)
	buf.Write(hdr)
	buf.Write(payload)

	if includeWindowUpdate {
		// WINDOW_UPDATE frame: length=4, type=0x08, flags=0x00, stream ID=0.
		wu := make([]byte, 13)
		wu[2] = 4    // length
		wu[3] = 0x08 // WINDOW_UPDATE
		binary.BigEndian.PutUint32(wu[9:], windowIncrement)
		buf.Write(wu)
	}

	return buf.Bytes()
}

// parseSettingsPayload decodes a SETTINGS frame payload into (id, value) pairs.
func parseSettingsPayload(payload []byte) [][2]uint32 {
	var result [][2]uint32
	for i := 0; i+6 <= len(payload); i += 6 {
		id := uint32(binary.BigEndian.Uint16(payload[i:]))
		val := binary.BigEndian.Uint32(payload[i+2:])
		result = append(result, [2]uint32{id, val})
	}
	return result
}

// TestPatchH2_ChromeSettingsPayload verifies that the output SETTINGS frame
// carries exactly Chrome's 4 parameters in the correct order regardless of
// what Go's http2.Transport originally wrote.
func TestPatchH2_ChromeSettingsPayload(t *testing.T) {
	// Simulate Go's typical SETTINGS: only HEADER_TABLE_SIZE and MAX_HEADER_LIST_SIZE.
	input := buildFakeH2Write([][2]uint32{
		{1, 4096},   // HEADER_TABLE_SIZE (Go default, not Chrome's)
		{6, 16384},  // MAX_HEADER_LIST_SIZE (Go default)
	}, 0, false)

	out := patchH2InitialWindowSize(input)
	if out == nil {
		t.Fatal("patchH2InitialWindowSize returned nil")
	}

	prefaceLen := len(h2ClientPreface)
	// Verify preface is preserved.
	if string(out[:prefaceLen]) != h2ClientPreface {
		t.Fatal("preface corrupted")
	}

	// Read the patched SETTINGS frame header.
	pos := prefaceLen
	gotLen := int(out[pos])<<16 | int(out[pos+1])<<8 | int(out[pos+2])
	gotType := out[pos+3]
	gotFlags := out[pos+4]

	if gotType != 0x04 {
		t.Fatalf("frame type: want 0x04 (SETTINGS), got 0x%02x", gotType)
	}
	if gotFlags != 0x00 {
		t.Fatalf("frame flags: want 0x00, got 0x%02x", gotFlags)
	}
	if gotLen != 24 {
		t.Fatalf("SETTINGS payload length: want 24 (4 params × 6 bytes), got %d", gotLen)
	}

	payload := out[pos+9 : pos+9+gotLen]
	params := parseSettingsPayload(payload)

	want := [][2]uint32{
		{1, 65536},   // HEADER_TABLE_SIZE
		{2, 0},       // ENABLE_PUSH
		{4, 6291456}, // INITIAL_WINDOW_SIZE
		{6, 262144},  // MAX_HEADER_LIST_SIZE
	}
	if len(params) != len(want) {
		t.Fatalf("param count: want %d, got %d", len(want), len(params))
	}
	for i, w := range want {
		if params[i] != w {
			t.Errorf("param[%d]: want ID=%d val=%d, got ID=%d val=%d",
				i, w[0], w[1], params[i][0], params[i][1])
		}
	}
}

// TestPatchH2_WindowUpdatePatched verifies that a WINDOW_UPDATE frame
// following the SETTINGS frame gets its increment set to Chrome's value.
func TestPatchH2_WindowUpdatePatched(t *testing.T) {
	const goDefaultWindowIncrement uint32 = 1073676289 // Go's typical value
	input := buildFakeH2Write([][2]uint32{
		{1, 4096},
		{4, 65535},
	}, goDefaultWindowIncrement, true)

	out := patchH2InitialWindowSize(input)
	if out == nil {
		t.Fatal("patchH2InitialWindowSize returned nil")
	}

	// Find the WINDOW_UPDATE frame after the SETTINGS frame.
	prefaceLen := len(h2ClientPreface)
	pos := prefaceLen
	settingsLen := int(out[pos])<<16 | int(out[pos+1])<<8 | int(out[pos+2])
	// Jump past SETTINGS frame (9-byte header + payload).
	wuPos := pos + 9 + settingsLen

	if wuPos+13 > len(out) {
		t.Fatalf("output too short to contain WINDOW_UPDATE frame (wuPos=%d, len=%d)", wuPos, len(out))
	}

	wuType := out[wuPos+3]
	if wuType != 0x08 {
		t.Fatalf("expected WINDOW_UPDATE (0x08) at wuPos, got 0x%02x", wuType)
	}

	gotIncrement := binary.BigEndian.Uint32(out[wuPos+9:])
	const wantIncrement uint32 = 15663105
	if gotIncrement != wantIncrement {
		t.Fatalf("WINDOW_UPDATE increment: want %d (Chrome), got %d", wantIncrement, gotIncrement)
	}
}

// TestPatchH2_NoWindowUpdate verifies that output is still valid when there
// is no WINDOW_UPDATE frame in the write buffer.
func TestPatchH2_NoWindowUpdate(t *testing.T) {
	input := buildFakeH2Write([][2]uint32{{4, 65535}}, 0, false)
	out := patchH2InitialWindowSize(input)
	if out == nil {
		t.Fatal("patchH2InitialWindowSize returned nil")
	}

	// Output must still have exactly 24-byte SETTINGS payload.
	prefaceLen := len(h2ClientPreface)
	gotLen := int(out[prefaceLen])<<16 | int(out[prefaceLen+1])<<8 | int(out[prefaceLen+2])
	if gotLen != 24 {
		t.Fatalf("SETTINGS payload length: want 24, got %d", gotLen)
	}
}

// TestPatchH2_InvalidInput verifies that malformed inputs return nil safely.
func TestPatchH2_InvalidInput(t *testing.T) {
	cases := [][]byte{
		nil,
		[]byte{},
		[]byte("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n"), // preface only, no frame
		[]byte("NOT THE H2 PREFACE"),
		[]byte("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n\x00\x00\x00\x01\x00\x00\x00\x00\x00"), // HEADERS not SETTINGS
	}
	for i, c := range cases {
		if got := patchH2InitialWindowSize(c); got != nil {
			t.Errorf("case %d: expected nil, got non-nil output", i)
		}
	}
}

// TestChromeSettingsConn_PatchApplied verifies that chromeSettingsConn
// applies the patch on the first Write and passes through on subsequent writes.
func TestChromeSettingsConn_PatchApplied(t *testing.T) {
	input := buildFakeH2Write([][2]uint32{{4, 65535}}, 1073676289, true)

	var captured bytes.Buffer
	conn := &chromeSettingsConn{Conn: &memConn{buf: &captured}}

	n, err := conn.Write(input)
	if err != nil {
		t.Fatalf("Write error: %v", err)
	}
	if n != len(input) {
		t.Fatalf("Write returned n=%d, want %d", n, len(input))
	}

	out := captured.Bytes()
	prefaceLen := len(h2ClientPreface)
	gotLen := int(out[prefaceLen])<<16 | int(out[prefaceLen+1])<<8 | int(out[prefaceLen+2])
	if gotLen != 24 {
		t.Fatalf("after chromeSettingsConn.Write: SETTINGS payload length want 24, got %d", gotLen)
	}

	// Second write must pass through unmodified.
	captured.Reset()
	extra := []byte("extra data")
	conn.Write(extra)
	if !bytes.Equal(captured.Bytes(), extra) {
		t.Fatalf("second write not passed through unchanged")
	}
}

// memConn is a net.Conn stub that writes to a bytes.Buffer for testing.
type memConn struct {
	bytes.Buffer
	buf *bytes.Buffer
}

func (m *memConn) Write(b []byte) (int, error)        { return m.buf.Write(b) }
func (m *memConn) Read(b []byte) (int, error)         { return 0, nil }
func (m *memConn) Close() error                       { return nil }
func (m *memConn) LocalAddr() net.Addr                { return nil }
func (m *memConn) RemoteAddr() net.Addr               { return nil }
func (m *memConn) SetDeadline(_ time.Time) error      { return nil }
func (m *memConn) SetReadDeadline(_ time.Time) error  { return nil }
func (m *memConn) SetWriteDeadline(_ time.Time) error { return nil }
