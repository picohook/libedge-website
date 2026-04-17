// ====================== BİLDİRİM MERKEZİ ======================
// /api/notifications endpoint'ini kullanır, 30sn'de bir poll eder,
// XSS-safe render yapar, CSP-uyumlu (inline onclick yok).
// ===============================================================

(function () {
    'use strict';

    const NOTIF_POLL_INTERVAL = 30000; // 30 sn
    const NOTIF_MAX_PREVIEW = 10;

    let pollTimer = null;
    let lastKnownUnread = 0;
    let isOpen = false;
    let isLoading = false;
    let initialized = false;

    // ---------- Yardımcılar ----------
    function escapeHtml(text) {
        if (typeof window.escapeHtml === 'function') {
            return window.escapeHtml(text);
        }
        if (typeof text !== 'string') text = String(text == null ? '' : text);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function timeAgo(iso) {
        if (!iso) return '';
        const now = Date.now();
        const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
        if (!then) return '';
        const diff = Math.max(0, Math.floor((now - then) / 1000));
        if (diff < 60) return 'az önce';
        if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} g önce`;
        return new Date(then).toLocaleDateString('tr-TR');
    }

    function iconForType(type) {
        const map = {
            file_shared: 'fa-file-import',
            announcement: 'fa-bullhorn',
            system: 'fa-cog',
            support: 'fa-life-ring',
            info: 'fa-info-circle'
        };
        return map[type] || 'fa-bell';
    }

    function classForType(type) {
        const map = {
            file_shared: 'notif-type-file',
            announcement: 'notif-type-announcement',
            system: 'notif-type-system',
            support: 'notif-type-support',
            info: 'notif-type-info'
        };
        return map[type] || 'notif-type-info';
    }

    // ---------- DOM erişim ----------
    function $(id) { return document.getElementById(id); }

    function setBadge(count) {
        const badge = $('notifBadge');
        if (!badge) return;
        lastKnownUnread = count;
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    function renderList(notifications) {
        const list = $('notifList');
        if (!list) return;

        if (!Array.isArray(notifications) || notifications.length === 0) {
            list.innerHTML = `
                <div class="notif-empty">
                    <i class="far fa-bell-slash text-3xl mb-2 text-gray-300"></i>
                    <p class="text-sm text-gray-500">Henüz bildirim yok</p>
                </div>
            `;
            return;
        }

        const items = notifications.slice(0, NOTIF_MAX_PREVIEW).map(n => {
            const id = Number(n.id) || 0;
            const title = escapeHtml(n.title || 'Bildirim');
            const body = escapeHtml(n.content || n.body || '');
            const type = escapeHtml(n.type || 'info');
            const when = escapeHtml(timeAgo(n.created_at));
            const unreadClass = n.is_read ? '' : 'notif-unread';
            return `
                <button type="button" class="notif-item ${unreadClass}" data-notif-id="${id}" data-read="${n.is_read ? '1' : '0'}">
                    <span class="notif-icon ${classForType(n.type)}">
                        <i class="fas ${iconForType(n.type)}"></i>
                    </span>
                    <span class="notif-body">
                        <span class="notif-title">${title}</span>
                        ${body ? `<span class="notif-text">${body}</span>` : ''}
                        <span class="notif-meta"><span class="notif-type-badge ${classForType(n.type)}">${type}</span><span class="notif-time">${when}</span></span>
                    </span>
                    ${n.is_read ? '' : '<span class="notif-dot" aria-hidden="true"></span>'}
                </button>
            `;
        }).join('');

        list.innerHTML = items;
    }

    // ---------- API çağrıları ----------
    async function fetchNotifications(silent = false) {
        if (isLoading && !silent) return;
        isLoading = true;

        try {
            const res = await fetch('/api/notifications?limit=20', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    setBadge(0);
                    renderList([]);
                }
                return;
            }
            const data = await res.json();
            const items = Array.isArray(data.notifications) ? data.notifications : [];
            setBadge(Number(data.unread_count || 0));
            if (isOpen || !silent) renderList(items);
        } catch (err) {
            queueMicrotask(() => console.error('Bildirim yükleme hatası:', err && err.toString()));
        } finally {
            isLoading = false;
        }
    }

    async function markOneRead(id) {
        if (!id) return;
        try {
            const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
                method: 'PATCH',
                credentials: 'include'
            });
            if (res.ok) {
                setBadge(Math.max(0, lastKnownUnread - 1));
            }
        } catch (err) {
            queueMicrotask(() => console.error('Bildirim okundu hatası:', err && err.toString()));
        }
    }

    async function markAllRead() {
        try {
            const res = await fetch('/api/notifications/read-all', {
                method: 'PATCH',
                credentials: 'include'
            });
            if (res.ok) {
                setBadge(0);
                // Listedeki görselleri güncelle
                const items = document.querySelectorAll('#notifList .notif-item');
                items.forEach(it => {
                    it.classList.remove('notif-unread');
                    it.dataset.read = '1';
                    const dot = it.querySelector('.notif-dot');
                    if (dot) dot.remove();
                });
            }
        } catch (err) {
            queueMicrotask(() => console.error('Tümünü okundu hatası:', err && err.toString()));
        }
    }

    // ---------- Panel aç/kapat ----------
    function openPanel() {
        const panel = $('notifPanel');
        const btn = $('notifBellBtn');
        if (!panel || !btn) return;
        panel.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        isOpen = true;
        fetchNotifications(false);
    }

    function closePanel() {
        const panel = $('notifPanel');
        const btn = $('notifBellBtn');
        if (!panel || !btn) return;
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        isOpen = false;
    }

    function togglePanel() {
        if (isOpen) closePanel(); else openPanel();
    }

    // ---------- Event bağlama ----------
    function bindEvents() {
        const bellBtn = $('notifBellBtn');
        const panel = $('notifPanel');
        const markAllBtn = $('notifMarkAllBtn');
        const list = $('notifList');

        if (!bellBtn || !panel) return false;
        if (bellBtn.dataset.notifBound === 'true') return true;
        bellBtn.dataset.notifBound = 'true';

        bellBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            togglePanel();
        });

        if (markAllBtn) {
            markAllBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                markAllRead();
            });
        }

        // Liste tıklama — event delegation
        if (list) {
            list.addEventListener('click', function (e) {
                const item = e.target.closest('.notif-item');
                if (!item) return;
                const id = Number(item.dataset.notifId);
                const wasRead = item.dataset.read === '1';
                if (id && !wasRead) {
                    item.classList.remove('notif-unread');
                    item.dataset.read = '1';
                    const dot = item.querySelector('.notif-dot');
                    if (dot) dot.remove();
                    markOneRead(id);
                }
            });
        }

        // Dışarı tıklanınca kapat
        document.addEventListener('click', function (e) {
            if (!isOpen) return;
            if (e.target.closest('#notifRoot')) return;
            closePanel();
        });

        // ESC ile kapat
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && isOpen) closePanel();
        });

        return true;
    }

    // ---------- Polling ----------
    function startPolling() {
        stopPolling();
        pollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchNotifications(true);
            }
        }, NOTIF_POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    // ---------- Lifecycle ----------
    function initialize() {
        if (initialized) return;
        if (!bindEvents()) return;
        initialized = true;
        fetchNotifications(true);
        startPolling();
    }

    function teardown() {
        stopPolling();
        setBadge(0);
        const list = $('notifList');
        if (list) list.innerHTML = '';
        initialized = false;
    }

    // Auth-aware bootstrap
    document.addEventListener('auth:ready', function (ev) {
        const user = ev && ev.detail && ev.detail.user;
        if (user) initialize();
        else teardown();
    });

    // Header partial sonradan yüklenirse
    document.addEventListener('header:ready', function () {
        if (window.currentUser) initialize();
    });

    // Sayfa görünür olduğunda anında tazele
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && initialized) {
            fetchNotifications(true);
        }
    });

    // Dışarıdan erişim (debug / manuel yenileme için)
    window.LibEdgeNotifications = {
        refresh: () => fetchNotifications(true),
        open: openPanel,
        close: closePanel,
        teardown
    };
})();
