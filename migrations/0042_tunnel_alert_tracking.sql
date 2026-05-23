-- Infra-02 — Tunnel down alert spam koruması.
-- runTunnelHeartbeat ardından çalışan alert mantığı, aynı kurum için 6 saat
-- içinde tekrar mail atmasın diye bu kolona son alert zamanını yazar.
-- Tunnel 'ok' durumuna döndüğünde kolon NULL'a sıfırlanır.

ALTER TABLE institution_ra_settings
  ADD COLUMN tunnel_alert_sent_at INTEGER;
