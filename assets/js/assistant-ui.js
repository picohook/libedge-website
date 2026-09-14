import('./assistant-ui-state.js').then(({ loadingStage, mapAssistantResult }) => {
    const sourcePanel = document.getElementById('assistantSources');
    const toast = document.getElementById('assistantPrototypeToast');
    const status = document.getElementById('assistantStatus');
    const queryInput = document.getElementById('assistantQuery');
    const answerCard = document.querySelector('.assistant-answer-card');
    const demoSearchButton = document.getElementById('assistantDemoSearch');

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.hidden = false;
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => {
            toast.hidden = true;
        }, 2600);
    }

    function openSources() {
        sourcePanel?.classList.add('is-open');
    }

    function closeSources() {
        sourcePanel?.classList.remove('is-open');
    }

    function setStatus({ title, message, tone = 'info', marker = '', state = '' }) {
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
        status.dataset.state = state;
        status.setAttribute('aria-busy', tone === 'loading' ? 'true' : 'false');
        const titleNode = status.querySelector('strong');
        const messageNode = status.querySelector('span:not(.assistant-status-time)');
        const markerNode = status.querySelector('.assistant-status-time');
        if (titleNode) titleNode.textContent = title;
        if (messageNode) messageNode.textContent = message;
        if (markerNode) markerNode.textContent = marker;
    }

    function markResearchGapsFixtureOnly() {
        const gapsCard = document.querySelector('.insight-card.gaps');
        if (!gapsCard || gapsCard.querySelector('[data-research-gaps-boundary]')) return;

        const note = document.createElement('p');
        note.dataset.researchGapsBoundary = 'fixture-only';
        note.setAttribute('role', 'note');
        note.textContent = 'Fixture-only · Bu araştırma boşlukları live API sonucundan üretilmiyor.';
        note.style.marginTop = '0.75rem';
        note.style.fontSize = '0.78rem';
        note.style.lineHeight = '1.45';
        note.style.color = '#6b7280';
        gapsCard.appendChild(note);
    }

    function clearEvidenceFocus() {
        document.querySelectorAll('.source-card.is-highlighted, .source-card.is-related').forEach((card) => {
            card.classList.remove('is-highlighted', 'is-related');
        });
        document.querySelectorAll('.finding-item.is-evidence-active').forEach((finding) => {
            finding.classList.remove('is-evidence-active');
            finding.setAttribute('aria-pressed', 'false');
        });
    }

    function relatedFindingsForSource(sourceId) {
        return [...document.querySelectorAll('.finding-item')].filter((finding) =>
            finding.querySelector(`.citation-chip[data-source="${sourceId}"]`)
        );
    }

    function markRelatedFindings(sourceId) {
        relatedFindingsForSource(sourceId).forEach((finding) => {
            finding.classList.add('is-evidence-active');
            finding.setAttribute('aria-pressed', 'true');
        });
    }

    function highlightSource(sourceId, { preserveRelated = false } = {}) {
        const target = document.getElementById(sourceId);
        if (!target) return;
        if (!preserveRelated) clearEvidenceFocus();
        target.classList.add('is-highlighted', 'is-related');
        markRelatedFindings(sourceId);
        openSources();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
        window.clearTimeout(highlightSource.timer);
        highlightSource.timer = window.setTimeout(() => target.classList.remove('is-highlighted'), 3200);
    }

    function focusFindingEvidence(finding) {
        const sourceIds = [...finding.querySelectorAll('.citation-chip[data-source]')]
            .map((chip) => chip.dataset.source)
            .filter((sourceId, index, all) => sourceId && all.indexOf(sourceId) === index);
        if (!sourceIds.length) return;

        clearEvidenceFocus();
        finding.classList.add('is-evidence-active');
        finding.setAttribute('aria-pressed', 'true');
        sourceIds.forEach((sourceId) => document.getElementById(sourceId)?.classList.add('is-related'));
        openSources();

        const firstSource = document.getElementById(sourceIds[0]);
        firstSource?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstSource?.focus({ preventScroll: true });
        showToast(`${sourceIds.length} kanıt kaydı bu bulguyla ilişkilendirildi.`);
    }

    function setLoadingUi(isLoading) {
        if (demoSearchButton) {
            demoSearchButton.disabled = isLoading;
            demoSearchButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
        }
        if (queryInput) queryInput.readOnly = isLoading;
        answerCard?.classList.toggle('is-loading', isLoading);
    }

    function renderMappedState(result) {
        const mapped = mapAssistantResult(result);
        setStatus({
            title: mapped.title,
            message: mapped.message,
            tone: mapped.tone,
            marker: mapped.evidencePackId ? 'EvidencePack hazır' : '',
            state: mapped.state
        });
        const isSuccess = mapped.state === 'success';
        answerCard?.classList.toggle('is-unavailable', !isSuccess);
        if (answerCard) answerCard.style.opacity = isSuccess ? '1' : '.58';
        if (!isSuccess) {
            clearEvidenceFocus();
            closeSources();
        }
        return mapped;
    }

    function wait(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }

    async function runFixtureLifecycle() {
        const query = queryInput?.value?.trim() || '';
        if (query.length < 2 || query.length > 300) {
            renderMappedState({ ok: false, code: 'ASSISTANT_QUERY_INVALID', claims: [] });
            queryInput?.focus();
            return;
        }

        setLoadingUi(true);
        clearEvidenceFocus();
        closeSources();
        if (answerCard) answerCard.style.opacity = '.58';

        try {
            for (let index = 0; index < 3; index += 1) {
                const stage = loadingStage(index);
                setStatus({
                    title: stage.title,
                    message: stage.message,
                    tone: 'loading',
                    marker: `Aşama ${index + 1}/3`,
                    state: `loading-${index + 1}`
                });
                await wait(420);
            }

            renderMappedState({
                ok: true,
                code: 'OK',
                claims: [{ text: 'Fixture claim', evidence_ids: ['fixture:e1'] }],
                evidence_pack_id: 'fixture-pack'
            });
            showToast('Fixture lifecycle tamamlandı. Gerçek /api/assistant/ask çağrısı yapılmadı.');
        } catch (error) {
            console.error('Assistant fixture lifecycle failed:', error);
            renderMappedState({ ok: false, code: 'UI_RENDER_FAILED', claims: [] });
        } finally {
            setLoadingUi(false);
        }
    }

    function bindFindingEvidenceInteractions() {
        document.querySelectorAll('.finding-item').forEach((finding) => {
            const sourceCount = finding.querySelectorAll('.citation-chip[data-source]').length;
            if (!sourceCount) return;
            finding.tabIndex = 0;
            finding.setAttribute('role', 'button');
            finding.setAttribute('aria-pressed', 'false');
            finding.setAttribute('aria-label', `Bulgu için ${sourceCount} ilişkili kanıt kaydını göster`);
            finding.addEventListener('click', (event) => {
                if (event.target.closest('.citation-chip')) return;
                focusFindingEvidence(finding);
            });
            finding.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                focusFindingEvidence(finding);
            });
        });
    }

    markResearchGapsFixtureOnly();
    bindFindingEvidenceInteractions();

    document.querySelectorAll('.citation-chip[data-source]').forEach((button) => {
        button.addEventListener('click', () => highlightSource(button.dataset.source));
    });
    document.getElementById('viewSourcesBtn')?.addEventListener('click', openSources);
    document.getElementById('closeSourcesBtn')?.addEventListener('click', closeSources);
    document.querySelectorAll('.assistant-mode').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.assistant-mode').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            if (button.dataset.mode === 'gaps') {
                showToast('Araştırma boşlukları şimdilik fixture-only. Live gap verisi için ayrı, minimize edilmiş API contract review gereklidir.');
                return;
            }
            if (button.dataset.mode !== 'ask') showToast('Bu mod prototipte yalnızca görsel olarak gösteriliyor. İlk sürümde “Sor” deneyimini tamamlayacağız.');
        });
    });
    demoSearchButton?.addEventListener('click', runFixtureLifecycle);
    document.querySelectorAll('.source-action').forEach((button) => {
        button.addEventListener('click', () => {
            const sourceCard = button.closest('.source-card');
            if (!sourceCard?.id) return;
            highlightSource(sourceCard.id);
            showToast('Bu kanıt kaydını kullanan bulgular vurgulandı.');
        });
    });
    document.querySelectorAll('.assistant-answer-actions button:not(#viewSourcesBtn)').forEach((button) => {
        if (!button.disabled) button.addEventListener('click', () => showToast('Bu aksiyon sonraki UI iterasyonunda etkinleştirilecek.'));
    });
    document.querySelectorAll('.assistant-filter').forEach((button) => button.addEventListener('click', () => showToast('Filtre kontrolleri prototipte pasif; backend bağlantısı yapılmadı.')));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            clearEvidenceFocus();
            closeSources();
        }
    });
}).catch((error) => {
    console.error('Assistant UI state module failed to load:', error);
});