// Super-admin only system health widget for admin dashboard.
// Reads only the sanitized /api/admin/system-health summary; no secrets or PII.
(function () {
    'use strict';

    const API_URL = '/api/admin/system-health';
    let detailsPanel = null;

    function statusText(status) {
        return status === 'ok' ? 'Çalışıyor' : 'Sorun';
    }

    function setStatusTone(element, ok) {
        if (!element) return;
        element.classList.remove('text-green-600', 'text-red-600', 'text-gray-500');
        element.classList.add(ok ? 'text-green-600' : 'text-red-600');
    }

    function createRow(label, value, ok = null) {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0';

        const name = document.createElement('span');
        name.className = 'text-sm text-gray-600';
        name.textContent = label;

        const val = document.createElement('span');
        val.className = 'text-sm font-semibold text-gray-800 text-right';
        val.textContent = value;
        if (ok !== null) setStatusTone(val, ok);

        row.append(name, val);
        return row;
    }

    function ensureDetailsPanel(card) {
        if (detailsPanel?.isConnected) return detailsPanel;

        const statsGrid = card.closest('.grid');
        if (!statsGrid) return null;

        const panel = document.createElement('section');
        panel.id = 'systemHealthDetails';
        panel.className = 'hidden bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 border border-gray-100';
        panel.setAttribute('aria-live', 'polite');

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-3 mb-3';

        const titleWrap = document.createElement('div');
        const title = document.createElement('h3');
        title.className = 'text-lg font-semibold text-gray-800';
        title.textContent = 'Sistem Durumu / Güvenlik Sağlığı';
        const note = document.createElement('p');
        note.className = 'text-xs text-gray-500 mt-1';
        note.textContent = 'Yalnız teknik özet gösterilir; secret, token ve kişisel veri gösterilmez.';
        titleWrap.append(title, note);

        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.id = 'systemHealthRefreshBtn';
        refresh.className = 'btn border border-gray-200 bg-white text-gray-700 hover:bg-gray-50';
        refresh.textContent = 'Yenile';
        refresh.addEventListener('click', () => loadSystemHealth(true));

        header.append(titleWrap, refresh);

        const meta = document.createElement('div');
        meta.id = 'systemHealthMeta';
        meta.className = 'text-xs text-gray-500 mb-3';

        const rows = document.createElement('div');
        rows.id = 'systemHealthRows';
        rows.className = 'divide-y divide-gray-100';

        panel.append(header, meta, rows);
        statsGrid.insertAdjacentElement('afterend', panel);
        detailsPanel = panel;
        return panel;
    }

    function renderDetails(data, card) {
        const panel = ensureDetailsPanel(card);
        if (!panel) return;

        const meta = panel.querySelector('#systemHealthMeta');
        const rows = panel.querySelector('#systemHealthRows');
        if (!meta || !rows) return;

        const checked = data.checked_at ? new Date(data.checked_at) : null;
        const checkedText = checked && !Number.isNaN(checked.getTime())
            ? checked.toLocaleString('tr-TR')
            : '—';
        meta.textContent = `${data.environment || 'unknown'} • ${data.worker_name || 'unknown'} • Son kontrol: ${checkedText}`;

        rows.replaceChildren(
            createRow('D1 veritabanı', statusText(data.components?.database?.status), data.components?.database?.status === 'ok'),
            createRow('R2 dosya depolama', statusText(data.components?.object_storage?.status), data.components?.object_storage?.status === 'ok'),
            createRow('KV rate-limit deposu', statusText(data.components?.rate_limit_store?.status), data.components?.rate_limit_store?.status === 'ok'),
            createRow('Bekleyen privacy R2 purge', String(data.privacy?.pending_r2_purge ?? '—')),
            createRow('Son 24 saat admin işlemi', String(data.activity?.actions_24h ?? '—')),
        );
    }

    function renderSummary(data, card) {
        const value = document.getElementById('systemHealthStatus');
        const sub = document.getElementById('systemHealthSub');
        const icon = document.getElementById('systemHealthIcon');
        const healthy = data.status === 'healthy';

        if (value) {
            value.textContent = healthy ? 'Sağlıklı' : 'Kontrol Et';
            setStatusTone(value, healthy);
        }
        if (sub) {
            const pending = Number(data.privacy?.pending_r2_purge || 0);
            sub.textContent = pending > 0 ? `${pending} privacy purge bekliyor` : 'D1 • R2 • KV';
        }
        if (icon) {
            icon.classList.remove('text-green-500', 'text-red-500', 'text-gray-400');
            icon.classList.add(healthy ? 'text-green-500' : 'text-red-500');
        }

        card.classList.remove('hidden');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-expanded', detailsPanel && !detailsPanel.classList.contains('hidden') ? 'true' : 'false');
        card.title = 'Sistem sağlığı ayrıntılarını göster/gizle';
        renderDetails(data, card);
    }

    async function loadSystemHealth(showPanel = false) {
        const card = document.getElementById('systemHealthCard');
        if (!card) return;

        const refresh = document.getElementById('systemHealthRefreshBtn');
        if (refresh) refresh.disabled = true;

        try {
            const response = await fetch(API_URL, { credentials: 'include', cache: 'no-store' });
            if (response.status === 401 || response.status === 403) {
                card.classList.add('hidden');
                detailsPanel?.classList.add('hidden');
                return;
            }
            if (!response.ok) throw new Error('health request failed');
            const data = await response.json();
            renderSummary(data, card);
            if (showPanel && detailsPanel) {
                detailsPanel.classList.remove('hidden');
                card.setAttribute('aria-expanded', 'true');
            }
        } catch {
            const value = document.getElementById('systemHealthStatus');
            const sub = document.getElementById('systemHealthSub');
            if (value) {
                value.textContent = 'Kontrol Edilemedi';
                setStatusTone(value, false);
            }
            if (sub) sub.textContent = 'Tekrar deneyin';
            card.classList.remove('hidden');
        } finally {
            if (refresh) refresh.disabled = false;
        }
    }

    function toggleDetails() {
        const card = document.getElementById('systemHealthCard');
        if (!card || !detailsPanel) return;
        const willShow = detailsPanel.classList.contains('hidden');
        detailsPanel.classList.toggle('hidden', !willShow);
        card.setAttribute('aria-expanded', willShow ? 'true' : 'false');
    }

    function init() {
        const card = document.getElementById('systemHealthCard');
        if (!card || card.dataset.healthBound === 'true') return;
        card.dataset.healthBound = 'true';
        card.addEventListener('click', (event) => {
            if (event.target.closest('button, a, input, select')) return;
            toggleDetails();
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleDetails();
            }
        });
        loadSystemHealth(false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
