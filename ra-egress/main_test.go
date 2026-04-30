package main

import (
	"net/http"
	"regexp"
	"testing"

	"golang.org/x/net/http2"
)

// selectClient host'a göre h1Client mı autoClient mı seçiyor — regression koruması.
//
// Bug: 8a24d38 commit'i AWS WAF'ı (JoVE) aşmak için TÜM publisher'lar için
// HTTP/2'yi kapattı. Cloudflare-fronted publisher'lar (ACS, AR, WoS) HTTP/2
// fingerprint bekliyor, HTTP/1.1 forced gelirse bot diye 403 veriyor.
//
// Fix: forceH1Regex sadece JoVE (AWS WAF) için match etsin; kalan tümü
// autoClient (HTTP/2 öncelikli) ile gitsin.
func TestSelectClient_DefaultJoVEForcedToH1(t *testing.T) {
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
