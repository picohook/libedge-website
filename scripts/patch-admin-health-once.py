from pathlib import Path

path = Path('admin.html')
data = path.read_bytes()
nl = b'\r\n' if b'\r\n' in data else b'\n'


def lines(text: str) -> bytes:
    return text.encode('utf-8').replace(b'\n', nl)


new_card = lines('''            <div id="systemHealthCard" class="stat-card flex justify-between items-start hidden">
                <div>
                    <p class="text-gray-500 text-sm">Sistem Sağlığı</p>
                    <p id="systemHealthStatus" class="text-xl font-bold text-gray-500">Kontrol ediliyor</p>
                    <p id="systemHealthSub" class="text-xs text-gray-400 mt-0.5">D1 • R2 • KV</p>
                </div>
                <i id="systemHealthIcon" class="fas fa-shield-alt text-3xl text-gray-400 opacity-60"></i>
            </div>''')

health_script = b'<script src="assets/js/admin-health.js?v=20260907a"></script>'

if data.count(new_card) != 1:
    raise SystemExit(f'Expected exactly one system health card, found {data.count(new_card)}')
if data.count(health_script) != 1:
    raise SystemExit(f'Expected exactly one system health script, found {data.count(health_script)}')

source_lines = data.splitlines(keepends=True)
legacy_lines = [line for line in source_lines if b'statActiveTunnels' in line or 'Aktif Tünel'.encode('utf-8') in line]
if not legacy_lines:
    raise SystemExit('No obsolete tunnel references found')

for line in legacy_lines:
    print('Removing obsolete tunnel reference:', line.decode('utf-8', errors='replace').strip())

patched = b''.join(
    line for line in source_lines
    if b'statActiveTunnels' not in line and 'Aktif Tünel'.encode('utf-8') not in line
)

if b'statActiveTunnels' in patched or 'Aktif Tünel'.encode('utf-8') in patched:
    raise SystemExit('Obsolete tunnel reference remains after patch')
if patched.count(new_card) != 1 or patched.count(health_script) != 1:
    raise SystemExit('System health integration changed unexpectedly')

path.write_bytes(patched)
print(f'Cleaned {len(legacy_lines)} obsolete tunnel reference line(s)')
