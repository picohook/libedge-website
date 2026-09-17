(function () {
    'use strict';

    const TEXT = {
        tr: {
            documentTitle: 'LibEdge - Duyurular', reactionsAria: 'Reaksiyonlar', comments: 'Yorumlar', commentSingular: 'yorum', commentPlural: 'yorum',
            loginPrefix: 'Yorum yapabilmek için ', loginLink: 'giriş yapmanız', loginSuffix: ' gerekir.', commentPlaceholder: 'Yorumunu yaz…', commentAria: 'Yorum metni',
            send: 'Gönder', delete: 'Sil', noComments: 'Henüz yorum yok. İlk yorumu sen yap!', engagementLoadFailed: 'Etkileşim yüklenemedi.', loginRequired: 'Giriş yapın',
            reactionLabels: { like: 'Beğen', love: 'Sevdim', clap: 'Alkış', insightful: 'Aydınlatıcı', celebrate: 'Kutla' }, activeSubscription: 'Abonelik Aktif', subscribe: 'Abone Ol', sending: 'Gönderiliyor',
            subscribedStatus: email => `${email} adresiyle bülten aboneliğiniz aktif. İsterseniz profilinizden iptal edebilirsiniz.`, canSubscribeStatus: email => `${email} adresiyle abone olabilirsiniz.`, closeModalAria: 'Modali kapat'
        },
        en: {
            documentTitle: 'LibEdge - Announcements', reactionsAria: 'Reactions', comments: 'Comments', commentSingular: 'comment', commentPlural: 'comments',
            loginPrefix: 'You must ', loginLink: 'sign in', loginSuffix: ' to leave a comment.', commentPlaceholder: 'Write a comment…', commentAria: 'Comment text',
            send: 'Send', delete: 'Delete', noComments: 'No comments yet. Be the first to comment!', engagementLoadFailed: 'Engagement could not be loaded.', loginRequired: 'Sign in',
            reactionLabels: { like: 'Like', love: 'Love', clap: 'Applaud', insightful: 'Insightful', celebrate: 'Celebrate' }, activeSubscription: 'Subscription Active', subscribe: 'Subscribe', sending: 'Sending',
            subscribedStatus: email => `Your newsletter subscription is active for ${email}. You can unsubscribe from your profile.`, canSubscribeStatus: email => `You can subscribe with ${email}.`, closeModalAria: 'Close modal'
        }
    };

    const TOAST_EN = new Map([
        ['Reaksiyon eklenemedi', 'Reaction could not be added'], ['Yorum en fazla 2000 karakter olabilir', 'Comments can be at most 2000 characters'],
        ['Yorum eklenemedi', 'Comment could not be added'], ['Yorumun yayınlandı', 'Your comment was published'], ['Yorum gönderilemedi', 'Comment could not be sent'],
        ['Silme başarısız', 'Delete failed'], ['Yorum silindi', 'Comment deleted'], ['Lütfen e-posta adresinizi girin', 'Please enter your email address'],
        ['Geçerli bir e-posta adresi girin', 'Please enter a valid email address'], ['Bülten aboneliğiniz zaten aktif', 'Your newsletter subscription is already active'],
        ['Bülten aboneliğiniz başarıyla oluşturuldu!', 'Your newsletter subscription was created successfully!'], ['Bülten aboneliği sırasında bir hata oluştu', 'An error occurred while subscribing to the newsletter']
    ]);

    function language() {
        try {
            if (typeof announcementManager !== 'undefined' && announcementManager) return announcementManager.currentLanguage === 'en' ? 'en' : 'tr';
        } catch (_) {}
        return localStorage.getItem('announcementLanguage') === 'en' ? 'en' : 'tr';
    }

    function ui() { return TEXT[language()]; }
    function setText(el, value) { if (el && el.textContent !== value) el.textContent = value; }
    function setHtml(el, value) { if (el && el.innerHTML !== value) el.innerHTML = value; }
    function setAttr(el, name, value) { if (el && el.getAttribute(name) !== value) el.setAttribute(name, value); }

    function localizeEngagement() {
        const t = ui();
        if (document.title !== t.documentTitle) document.title = t.documentTitle;
        const closeIconButton = document.querySelector('#announcementModal button[onclick="closeModal()"]');
        setAttr(closeIconButton, 'aria-label', t.closeModalAria);
        const bar = document.getElementById('reactionsBar');
        if (bar) {
            setAttr(bar, 'aria-label', t.reactionsAria);
            bar.querySelectorAll('.reaction-btn[data-reaction]').forEach(btn => {
                const key = btn.dataset.reaction;
                const label = t.reactionLabels[key] || key;
                setAttr(btn, 'title', label + (btn.disabled ? ` (${t.loginRequired})` : ''));
            });
        }
        setHtml(document.querySelector('.comments-heading h3'), `<i class="far fa-comments mr-2"></i>${t.comments}`);
        const count = document.getElementById('commentsCount');
        if (count && /^\d+\s+/.test(count.textContent || '')) {
            const n = Number.parseInt(count.textContent, 10) || 0;
            setText(count, `${n} ${n === 1 ? t.commentSingular : t.commentPlural}`);
        }
        setHtml(document.querySelector('.comment-login-prompt'), `<i class="fas fa-lock mr-1"></i>${t.loginPrefix}<a href="/profile.html">${t.loginLink}</a>${t.loginSuffix}`);
        const input = document.getElementById('commentInput');
        if (input) { if (input.placeholder !== t.commentPlaceholder) input.placeholder = t.commentPlaceholder; setAttr(input, 'aria-label', t.commentAria); }
        setHtml(document.querySelector('.comment-submit-btn'), `<i class="fas fa-paper-plane mr-1"></i>${t.send}`);
        document.querySelectorAll('.comment-action-btn[data-comment-delete]').forEach(btn => setHtml(btn, `<i class="far fa-trash-alt mr-1"></i>${t.delete}`));
        const empty = document.querySelector('.comment-empty');
        if (empty) {
            const loadingFailed = /Etkileşim yüklenemedi|Engagement could not be loaded/.test(empty.textContent || '');
            setHtml(empty, loadingFailed ? t.engagementLoadFailed : `<i class="far fa-comment-dots mr-2"></i>${t.noComments}`);
        }
    }

    function localizeNewsletter() {
        const t = ui();
        const button = document.querySelector('.newsletter-button');
        const status = document.getElementById('newsletterStatusText');
        const emailInput = document.getElementById('newsletterEmail');
        if (!button || !status || !emailInput) return;
        let state = null;
        try { state = typeof newsletterState !== 'undefined' ? newsletterState : null; } catch (_) {}
        if (state && state.loggedIn) {
            if (state.subscribed) { setText(status, t.subscribedStatus(state.email || '')); setHtml(button, `<i class="fas fa-check mr-2"></i>${t.activeSubscription}`); }
            else { setText(status, t.canSubscribeStatus(state.email || '')); setHtml(button, `<i class="fas fa-bell mr-2"></i>${t.subscribe}`); }
            return;
        }
        if (/Gönderiliyor|Sending/.test(button.textContent || '')) setHtml(button, `<i class="fas fa-spinner fa-spin mr-2"></i>${t.sending}`);
        else setHtml(button, `<i class="fas fa-bell mr-2"></i>${t.subscribe}`);
    }

    function localizeDynamicUi() { localizeEngagement(); localizeNewsletter(); }

    function patchManager() {
        if (typeof announcementManager === 'undefined' || !announcementManager || announcementManager.__extendedI18nPatched) return false;
        announcementManager.__extendedI18nPatched = true;
        const originalSetLanguage = announcementManager.setLanguage.bind(announcementManager);
        announcementManager.setLanguage = function (lang) { const result = originalSetLanguage(lang); queueMicrotask(localizeDynamicUi); return result; };
        const originalFormatCommentTime = announcementManager.formatCommentTime.bind(announcementManager);
        announcementManager.formatCommentTime = function (iso) {
            if (this.currentLanguage !== 'en') return originalFormatCommentTime(iso);
            if (!iso) return '';
            const then = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
            if (Number.isNaN(then.getTime())) return '';
            const diff = Math.max(0, Math.floor((Date.now() - then.getTime()) / 1000));
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
            if (diff < 604800) { const days = Math.floor(diff / 86400); return `${days} day${days === 1 ? '' : 's'} ago`; }
            return then.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        };
        const originalShowToast = announcementManager.showToast.bind(announcementManager);
        announcementManager.showToast = function (message, type) { return originalShowToast(this.currentLanguage === 'en' ? (TOAST_EN.get(message) || message) : message, type); };
        const originalConfirm = window.confirm.bind(window);
        if (!window.__announcementsConfirmI18nPatched) {
            window.__announcementsConfirmI18nPatched = true;
            window.confirm = function (message) {
                if (language() === 'en' && message === 'Bu yorumu silmek istediğinden emin misin?') return originalConfirm('Are you sure you want to delete this comment?');
                return originalConfirm(message);
            };
        }
        return true;
    }

    function init() {
        if (!patchManager()) { setTimeout(init, 0); return; }
        localizeDynamicUi();
        const modal = document.getElementById('announcementModal');
        if (modal) new MutationObserver(() => queueMicrotask(localizeDynamicUi)).observe(modal, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'title'] });
        const newsletter = document.querySelector('.newsletter-section');
        if (newsletter) new MutationObserver(() => queueMicrotask(localizeNewsletter)).observe(newsletter, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
