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

    function openSources() { sourcePanel?.classList.add('is-open'); }
    function closeSources() { sourcePanel?.classList.remove('is-open'); }

    function setStatus({ title, message, tone = 'info', marker = '', state = '' }) {
        if (!status) return;
        const tones = {
            success: ['#f0fdf4', '#bbf7d0', '#166534'], loading: ['#eff6ff', '#bfdbfe', '#1d4ed8'],
            notice: ['#f5f3ff', '#ddd6fe', '#6d28d9'], warning: ['#fffbeb', '#fde68a', '#92400e'],
            error: ['#fef2f2', '#fecaca', '#b91c1c'], info: ['#eff6ff', '#bfdbfe', '#1d4ed8']
        };
        const [background, border, color] = tones[tone] || tones.info;
        status.style.background = background; status.style.borderColor = border; status.style.color = color;
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
        note.dataset.researchGapsBoundary = 'fixture-only'; note.setAttribute('role', 'note');
        note.textContent = 'Fixture-only · Bu araştırma boşlukları live API sonucundan üretilmiyor.';
        note.style.marginTop = '0.75rem'; note.style.fontSize = '0.78rem'; note.style.lineHeight = '1.45'; note.style.color = '#6b7280';
        gapsCard.appendChild(note);
    }

    function clearEvidenceFocus() {
        document.querySelectorAll('.source-card.is-highlighted, .source-card.is-related').forEach((card) => card.classList.remove('is-highlighted', 'is-related'));
        document.querySelectorAll('.finding-item.is-evidence-active').forEach((finding) => {
            finding.classList.remove('is-evidence-active'); finding.setAttribute('aria-pressed', 'false');
        });
    }

    function relatedFindingsForSource(sourceId) {
        return [...document.querySelectorAll('.finding-item')].filter((finding) => finding.querySelector(`.citation-chip[data-source="${sourceId}"]`));
    }

    function sourceFindingLabels(sourceCard) {
        return relatedFindingsForSource(sourceCard?.id)
            .map((finding) => finding.querySelector('.finding-index')?.textContent?.trim())
            .filter(Boolean);
    }

    function appendDetailField(detail, label, value) {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label; description.textContent = value;
        row.append(term, description); detail.appendChild(row);
    }

    function prepareContextualFixtureFollowUp(prompt, contextLabel) {
        if (!queryInput) return;
        clearEvidenceFocus(); closeSourceDetails(); closeSources();
        queryInput.value = prompt;
        queryInput.dataset.followUp = 'fixture-only';
        queryInput.dataset.followUpContext = contextLabel;
        queryInput.setAttribute('aria-describedby', 'assistantPrototypeToast');
        queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        queryInput.focus({ preventScroll: true });
        queryInput.setSelectionRange(queryInput.value.length, queryInput.value.length);
        showToast(`${contextLabel} için fixture-only takip sorusu hazırlandı. Live API çağrısı yapılmadı.`);
    }

    function ensureSourceDetail(sourceCard, button) {
        let detail = sourceCard.querySelector('[data-source-detail]');
        if (detail) return detail;
        const content = sourceCard.querySelector('.source-content');
        if (!content) return null;

        detail = document.createElement('section');
        detail.className = 'source-detail'; detail.dataset.sourceDetail = 'fixture-only';
        detail.id = `${sourceCard.id}-detail`; detail.hidden = true; detail.setAttribute('aria-label', 'Fixture kanıt ayrıntısı');

        const boundary = document.createElement('p');
        boundary.className = 'source-detail-boundary';
        boundary.textContent = 'Fixture-only · Yeni kaynak verisi getirmez ve bibliyografik doğrulama yapmaz.';
        const list = document.createElement('dl');
        list.className = 'source-detail-list';
        const labels = sourceFindingLabels(sourceCard);
        appendDetailField(list, 'Bulgu bağı', labels.length ? labels.join(', ') : 'Özet');
        appendDetailField(list, 'Kanıt ilişkisi', sourceCard.querySelector('.evidence-relation')?.textContent?.trim() || 'İlişki belirtilmedi.');
        appendDetailField(list, 'Fixture künyesi', sourceCard.querySelector('.source-meta')?.textContent?.trim() || 'Metadata belirtilmedi.');
        appendDetailField(list, 'Kanıt sınıflaması', [...sourceCard.querySelectorAll('.source-badges span')].map((badge) => badge.textContent?.trim()).filter(Boolean).join(' · ') || 'Sınıflama belirtilmedi.');

        const followUp = document.createElement('button');
        followUp.type = 'button'; followUp.className = 'assistant-secondary-btn source-context-followup';
        followUp.dataset.fixtureOnly = 'true'; followUp.textContent = 'Bu kanıtı daha derin sor';
        const sourceLabel = sourceCard.querySelector('.source-rank')?.textContent?.trim() || 'Bu kanıt';
        followUp.setAttribute('aria-label', `${sourceLabel} için fixture-only takip sorusu hazırla`);
        followUp.addEventListener('click', () => prepareContextualFixtureFollowUp(
            `${sourceLabel} kanıtının bu bulgularla ilişkisini daha ayrıntılı açıkla.`, sourceLabel
        ));

        detail.append(boundary, list, followUp); content.appendChild(detail);
        button.setAttribute('aria-controls', detail.id);
        return detail;
    }

    function closeSourceDetails(except = null) {
        document.querySelectorAll('[data-source-detail]').forEach((detail) => {
            if (detail === except) return;
            detail.hidden = true;
            const owner = detail.closest('.source-card');
            owner?.classList.remove('is-detail-open');
            owner?.querySelector('.source-action')?.setAttribute('aria-expanded', 'false');
        });
    }

    function markRelatedFindings(sourceId) {
        relatedFindingsForSource(sourceId).forEach((finding) => {
            finding.classList.add('is-evidence-active'); finding.setAttribute('aria-pressed', 'true');
        });
    }

    function highlightSource(sourceId, { preserveRelated = false } = {}) {
        const target = document.getElementById(sourceId);
        if (!target) return;
        if (!preserveRelated) clearEvidenceFocus();
        target.classList.add('is-highlighted', 'is-related'); markRelatedFindings(sourceId); openSources();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.focus({ preventScroll: true });
        window.clearTimeout(highlightSource.timer);
        highlightSource.timer = window.setTimeout(() => target.classList.remove('is-highlighted'), 3200);
    }

    function toggleSourceDetail(button) {
        const sourceCard = button.closest('.source-card');
        if (!sourceCard?.id) return;
        const detail = ensureSourceDetail(sourceCard, button);
        if (!detail) return;
        const opening = detail.hidden;
        closeSourceDetails(opening ? detail : null);
        detail.hidden = !opening;
        button.setAttribute('aria-expanded', opening ? 'true' : 'false');
        sourceCard.classList.toggle('is-detail-open', opening);
        if (opening) {
            highlightSource(sourceCard.id);
            showToast('Fixture kanıt ayrıntısı açıldı; live kaynak verisi kullanılmıyor.');
        }
    }

    function focusFindingEvidence(finding) {
        const sourceIds = [...finding.querySelectorAll('.citation-chip[data-source]')].map((chip) => chip.dataset.source)
            .filter((sourceId, index, all) => sourceId && all.indexOf(sourceId) === index);
        if (!sourceIds.length) return;
        clearEvidenceFocus(); finding.classList.add('is-evidence-active'); finding.setAttribute('aria-pressed', 'true');
        sourceIds.forEach((sourceId) => document.getElementById(sourceId)?.classList.add('is-related')); openSources();
        const firstSource = document.getElementById(sourceIds[0]);
        firstSource?.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstSource?.focus({ preventScroll: true });
        showToast(`${sourceIds.length} kanıt kaydı bu bulguyla ilişkilendirildi.`);
    }

    function beginFixtureFollowUp() {
        if (!queryInput) return;
        clearEvidenceFocus(); closeSourceDetails(); closeSources();
        queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        queryInput.focus({ preventScroll: true });
        queryInput.setSelectionRange(queryInput.value.length, queryInput.value.length);
        queryInput.dataset.followUp = 'fixture-only';
        delete queryInput.dataset.followUpContext;
        queryInput.setAttribute('aria-describedby', 'assistantPrototypeToast');
        showToast('Takip sorunuzu yukarıdaki alana yazın. Çalıştırma yalnız fixture lifecycle kullanır; live API çağrısı yapılmaz.');
    }

    function addFindingContextualFollowUps() {
        document.querySelectorAll('.finding-item').forEach((finding) => {
            if (finding.querySelector('[data-context-followup]')) return;
            const label = finding.querySelector('.finding-index')?.textContent?.trim();
            const heading = finding.querySelector('h4')?.textContent?.trim();
            if (!label || !heading) return;
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'assistant-secondary-btn finding-context-followup';
            button.dataset.contextFollowup = 'fixture-only'; button.textContent = 'Derinleştir';
            button.setAttribute('aria-label', `${label} bulgusu için fixture-only takip sorusu hazırla`);
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                prepareContextualFixtureFollowUp(`${label} bulgusunu daha derin açıkla: ${heading}`, label);
            });
            button.addEventListener('keydown', (event) => event.stopPropagation());
            finding.querySelector('div')?.appendChild(button);
        });
    }

    function setLoadingUi(isLoading) {
        if (demoSearchButton) { demoSearchButton.disabled = isLoading; demoSearchButton.setAttribute('aria-busy', isLoading ? 'true' : 'false'); }
        if (queryInput) queryInput.readOnly = isLoading;
        answerCard?.classList.toggle('is-loading', isLoading);
    }

    function renderMappedState(result) {
        const mapped = mapAssistantResult(result);
        setStatus({ title: mapped.title, message: mapped.message, tone: mapped.tone, marker: mapped.evidencePackId ? 'EvidencePack hazır' : '', state: mapped.state });
        const isSuccess = mapped.state === 'success';
        answerCard?.classList.toggle('is-unavailable', !isSuccess);
        if (answerCard) answerCard.style.opacity = isSuccess ? '1' : '.58';
        if (!isSuccess) { clearEvidenceFocus(); closeSourceDetails(); closeSources(); }
        return mapped;
    }

    function wait(ms) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

    async function runFixtureLifecycle() {
        const query = queryInput?.value?.trim() || '';
        if (query.length < 2 || query.length > 300) { renderMappedState({ ok: false, code: 'ASSISTANT_QUERY_INVALID', claims: [] }); queryInput?.focus(); return; }
        setLoadingUi(true); clearEvidenceFocus(); closeSourceDetails(); closeSources();
        if (answerCard) answerCard.style.opacity = '.58';
        try {
            for (let index = 0; index < 3; index += 1) {
                const stage = loadingStage(index);
                setStatus({ title: stage.title, message: stage.message, tone: 'loading', marker: `Aşama ${index + 1}/3`, state: `loading-${index + 1}` });
                await wait(420);
            }
            renderMappedState({ ok: true, code: 'OK', claims: [{ text: 'Fixture claim', evidence_ids: ['fixture:e1'] }], evidence_pack_id: 'fixture-pack' });
            if (queryInput) { delete queryInput.dataset.followUp; delete queryInput.dataset.followUpContext; }
            showToast('Fixture lifecycle tamamlandı. Gerçek /api/assistant/ask çağrısı yapılmadı.');
        } catch (error) {
            console.error('Assistant fixture lifecycle failed:', error);
            renderMappedState({ ok: false, code: 'UI_RENDER_FAILED', claims: [] });
        } finally { setLoadingUi(false); }
    }

    function bindFindingEvidenceInteractions() {
        document.querySelectorAll('.finding-item').forEach((finding) => {
            const sourceCount = finding.querySelectorAll('.citation-chip[data-source]').length;
            if (!sourceCount) return;
            finding.tabIndex = 0; finding.setAttribute('role', 'button'); finding.setAttribute('aria-pressed', 'false');
            finding.setAttribute('aria-label', `Bulgu için ${sourceCount} ilişkili kanıt kaydını göster`);
            finding.addEventListener('click', (event) => { if (!event.target.closest('.citation-chip, [data-context-followup]')) focusFindingEvidence(finding); });
            finding.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault(); focusFindingEvidence(finding);
            });
        });
    }

    markResearchGapsFixtureOnly(); addFindingContextualFollowUps(); bindFindingEvidenceInteractions();
    document.querySelectorAll('.citation-chip[data-source]').forEach((button) => button.addEventListener('click', () => highlightSource(button.dataset.source)));
    document.getElementById('viewSourcesBtn')?.addEventListener('click', openSources);
    document.getElementById('closeSourcesBtn')?.addEventListener('click', () => { closeSourceDetails(); closeSources(); });
    document.querySelectorAll('.assistant-mode').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.assistant-mode').forEach((item) => item.classList.remove('active')); button.classList.add('active');
            if (button.dataset.mode === 'gaps') { showToast('Araştırma boşlukları şimdilik fixture-only. Live gap verisi için ayrı, minimize edilmiş API contract review gereklidir.'); return; }
            if (button.dataset.mode !== 'ask') showToast('Bu mod prototipte yalnızca görsel olarak gösteriliyor. İlk sürümde “Sor” deneyimini tamamlayacağız.');
        });
    });
    demoSearchButton?.addEventListener('click', runFixtureLifecycle);
    document.querySelectorAll('.source-action').forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', () => toggleSourceDetail(button));
    });
    const followUpButton = document.querySelector('.assistant-answer-actions .assistant-primary-btn');
    followUpButton?.addEventListener('click', beginFixtureFollowUp);
    document.querySelectorAll('.assistant-answer-actions button:not(#viewSourcesBtn):not(.assistant-primary-btn)').forEach((button) => {
        if (!button.disabled) button.addEventListener('click', () => showToast('Bu aksiyon sonraki UI iterasyonunda etkinleştirilecek.'));
    });
    document.querySelectorAll('.assistant-filter').forEach((button) => button.addEventListener('click', () => showToast('Filtre kontrolleri prototipte pasif; backend bağlantısı yapılmadı.')));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { clearEvidenceFocus(); closeSourceDetails(); closeSources(); }
    });
}).catch((error) => { console.error('Assistant UI state module failed to load:', error); });
