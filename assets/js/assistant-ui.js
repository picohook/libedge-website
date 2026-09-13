Promise.all([
    import('./assistant-ui-state.js'),
    import('./assistant-api.js')
]).then(([{ mapAssistantResult }, { askAssistant }]) => {
    const sourcePanel = document.getElementById('assistantSources');
    const toast = document.getElementById('assistantPrototypeToast');
    const status = document.getElementById('assistantStatus');
    const queryInput = document.getElementById('assistantQuery');
    const answerCard = document.querySelector('.assistant-answer-card');
    const askButton = document.getElementById('assistantDemoSearch');
    const fixtureNote = document.querySelector('.assistant-fixture-note');

    if (fixtureNote) {
        fixtureNote.innerHTML = '<i class="fas fa-flask"></i> İlk görünüm fixture; “Araştır / Sor” canlı, gate-korumalı backend endpoint’ini çağırır. Model/provider hâlâ kapalıdır.';
    }

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.hidden = false;
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2800);
    }

    function openSources() { sourcePanel?.classList.add('is-open'); }
    function closeSources() { sourcePanel?.classList.remove('is-open'); }

    function setStatus({ title, message, tone = 'info', marker = '' }) {
        if (!status) return;
        const tones = {
            success: ['#f0fdf4', '#bbf7d0', '#166534'],
            loading: ['#eff6ff', '#bfdbfe', '#1d4ed8'],
            notice: ['#f5f3ff', '#ddd6fe', '#6d28d9'],
            warning: ['#fffbeb', '#fde68a', '#92400e'],
            error: ['#fef2f2', '#fecaca', '#b91c1c'],
            info: ['#eff6ff', '#bfdbfe', '#1d4ed8']
        };
        const [background, border, color] = tones[tone] || tones.info;
        status.style.background = background;
        status.style.borderColor = border;
        status.style.color = color;
        const titleNode = status.querySelector('strong');
        const messageNode = status.querySelector('span:not(.assistant-status-time)');
        const markerNode = status.querySelector('.assistant-status-time');
        if (titleNode) titleNode.textContent = title;
        if (messageNode) messageNode.textContent = message;
        if (markerNode) markerNode.textContent = marker;
    }

    function renderMappedState(result) {
        const mapped = mapAssistantResult(result);
        setStatus({ title: mapped.title, message: mapped.message, tone: mapped.tone, marker: mapped.evidencePackId ? 'EvidencePack hazır' : '' });
        return mapped;
    }

    function hideFixtureResult() {
        if (answerCard) answerCard.hidden = true;
        if (sourcePanel) sourcePanel.hidden = true;
    }

    function highlightSource(sourceId) {
        const target = document.getElementById(sourceId);
        if (!target) return;
        document.querySelectorAll('.source-card.is-highlighted').forEach((card) => card.classList.remove('is-highlighted'));
        target.classList.add('is-highlighted');
        openSources();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
        window.clearTimeout(highlightSource.timer);
        highlightSource.timer = window.setTimeout(() => target.classList.remove('is-highlighted'), 3200);
    }

    async function runLiveGatedRequest() {
        const query = queryInput?.value?.trim() || '';
        if (query.length < 2 || query.length > 300) {
            renderMappedState({ ok: false, code: 'ASSISTANT_QUERY_INVALID', claims: [] });
            queryInput?.focus();
            return;
        }

        hideFixtureResult();
        if (askButton) askButton.disabled = true;
        setStatus({ title: 'Araştırma isteği işleniyor', message: 'DISCOVER ve EvidencePack katmanları çalışıyor. Model sağlayıcısına yalnız Provider Privacy Gate PASS olduğunda erişilebilir.', tone: 'loading', marker: 'Canlı backend' });

        try {
            const result = await askAssistant(query);
            if (result.ok === true && result.code === 'OK' && !Array.isArray(result.evidence)) {
                renderMappedState({ ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [], evidence_pack_id: result.evidence_pack_id });
                return;
            }
            const mapped = renderMappedState(result);
            if (mapped.state === 'auth-required' && typeof window.openLoginModal === 'function') {
                window.openLoginModal();
            }
        } catch (error) {
            console.error('Assistant request failed:', error);
            renderMappedState({ ok: false, code: 'ASSISTANT_HTTP_ERROR', claims: [] });
        } finally {
            if (askButton) askButton.disabled = false;
        }
    }

    document.querySelectorAll('.citation-chip[data-source]').forEach((button) => button.addEventListener('click', () => highlightSource(button.dataset.source)));
    document.getElementById('viewSourcesBtn')?.addEventListener('click', openSources);
    document.getElementById('closeSourcesBtn')?.addEventListener('click', closeSources);
    document.querySelectorAll('.assistant-mode').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.assistant-mode').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            if (button.dataset.mode !== 'ask') showToast('Bu mod henüz canlı backend akışına bağlanmadı. İlk canlı deneyim “Sor” modudur.');
        });
    });
    askButton?.addEventListener('click', runLiveGatedRequest);
    document.querySelectorAll('.source-action').forEach((button) => button.addEventListener('click', () => showToast('Fixture kaynak detayları gerçek evidence payload sözleşmesi gelene kadar bağlanmıyor.')));
    document.querySelectorAll('.assistant-filter').forEach((button) => button.addEventListener('click', () => showToast('Filtreler henüz Assistant endpoint sözleşmesine bağlanmadı.')));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSources(); });
}).catch((error) => {
    console.error('Assistant UI modules failed to load:', error);
});
