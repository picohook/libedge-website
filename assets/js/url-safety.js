// Shared URL helpers for frontend rendering.
// Keep this file dependency-free so pages can load it before auth/script bundles.
(function () {
    'use strict';

    function safeUrl(url, options = {}) {
        const fallback = options.fallback || '';
        const raw = String(url || '').trim();
        if (!raw) return fallback;
        try {
            const value = options.defaultProtocol && !/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith('/')
                ? `${options.defaultProtocol}${raw}`
                : raw;
            const parsed = new URL(value, window.location.origin);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
        } catch {
            return fallback;
        }
    }

    function safeHref(url) {
        return safeUrl(url, { fallback: '#' }) || '#';
    }

    function versionedUrl(url, version, options = {}) {
        const safe = safeUrl(url, options);
        if (!safe) return '';
        if (!version) return safe;
        const separator = safe.includes('?') ? '&' : '?';
        return `${safe}${separator}v=${encodeURIComponent(version)}`;
    }

    window.LibEdgeUrls = Object.freeze({
        safeUrl,
        safeHref,
        versionedUrl
    });
})();
