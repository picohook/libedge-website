async function requireResearchLogin() {
    try {
        let response = await fetch('/api/user/profile', { credentials: 'include' });
        if (response.status === 401) {
            const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
            if (refreshed.ok) response = await fetch('/api/user/profile', { credentials: 'include' });
        }
        if (!response.ok) {
            window.location.replace('index.html');
            return false;
        }
        return true;
    } catch {
        window.location.replace('index.html');
        return false;
    }
}

requireResearchLogin().then((authorized) => {
    if (!authorized) return;
    return import('./assistant-ui-state.js');
}).then((module) => {
    if (!module) return;
    const { bibliographicYear, loadingStage, mapAssistantResult, mapLiveAssistantResult } = module;
    const sourcePanel = document.getElementById('assistantSources');
    const toast = document.getElementById('assistantPrototypeToast');
    const status = document.getElementById('assistantStatus');
    const queryInput = document.getElementById('assistantQuery');
    const answerCard = document.querySelector('.assistant-answer-card');
    const historyPanel = document.getElementById('assistantHistoryPanel');
    const historyList = document.getElementById('assistantHistoryList');
    const demoSearchButton = document.getElementById('assistantDemoSearch');
    const isEnglish = () => localStorage.getItem('language') === 'en';
    const t = (tr, en) => isEnglish() ? en : tr;

    function markTranslatable(node, tr, en) {
        if (!node) return;
        node.classList.add('translatable');
        node.dataset.en = en;
        node.dataset.assistantTr = tr;
        node.textContent = t(tr, en);
    }

    function markComingSoon(button) {
        if (!button || button.dataset.comingSoon === 'true') return;
        button.dataset.comingSoon = 'true';
        button.setAttribute('aria-disabled', 'true');
        button.style.opacity = '0.52';
        button.style.cursor = 'not-allowed';
        const badge = document.createElement('span');
        badge.className = 'assistant-coming-soon-badge';
        badge.textContent = t('Yakında', 'Coming soon');
        badge.style.marginInlineStart = '0.4rem';
        badge.style.fontSize = '0.68em';
        badge.style.fontWeight = '700';
        badge.style.opacity = '0.9';
        button.appendChild(badge);
    }

    function showToast(tr, en = tr) {
        if (!toast) return;
        markTranslatable(toast, tr, en);
        toast.hidden = false;
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 2600);
    }

    function openSources() { sourcePanel?.classList.add('is-open'); }
    function closeSources() { sourcePanel?.classList.remove('is-open'); }

    function setStatus({ title, titleEn = title, message, messageEn = message, tone = 'info', marker = '', markerEn = marker, state = '' }) {
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
        markTranslatable(status.querySelector('strong'), title, titleEn);
        markTranslatable(status.querySelector('span:not(.assistant-status-time)'), message, messageEn);
        markTranslatable(status.querySelector('.assistant-status-time'), marker, markerEn);
    }

    function markResearchGapsFixtureOnly() {
        const gapsCard = document.querySelector('.insight-card.gaps');
        if (!gapsCard || gapsCard.querySelector('[data-research-gaps-boundary]')) return;
        const note = document.createElement('p');
        note.dataset.researchGapsBoundary = 'fixture-only'; note.setAttribute('role', 'note');
        markTranslatable(note, 'Fixture-only · Bu araştırma boşlukları live API sonucundan üretilmiyor.', 'FIXTURE-ONLY · These research gaps are not generated from a live API result.');
        note.style.marginTop = '0.75rem'; note.style.fontSize = '0.78rem'; note.style.lineHeight = '1.45'; note.style.color = '#6b7280';
        gapsCard.appendChild(note);
    }

    function clearEvidenceFocus() {
        document.querySelectorAll('.source-card.is-highlighted, .source-card.is-related').forEach((card) => card.classList.remove('is-highlighted', 'is-related'));
        document.querySelectorAll('.finding-item.is-evidence-active').forEach((finding) => { finding.classList.remove('is-evidence-active'); finding.setAttribute('aria-pressed', 'false'); });
    }

    function relatedFindingsForSource(sourceId) {
        return [...document.querySelectorAll('.finding-item')].filter((finding) => finding.querySelector(`.citation-chip[data-source="${sourceId}"]`));
    }

    function sourceFindingLabels(sourceCard) {
        return relatedFindingsForSource(sourceCard?.id).map((finding) => finding.querySelector('.finding-index')?.textContent?.trim()).filter(Boolean);
    }

    function appendDetailField(detail, trLabel, enLabel, value) {
        const row = document.createElement('div'); const term = document.createElement('dt'); const description = document.createElement('dd');
        markTranslatable(term, trLabel, enLabel); description.textContent = value; row.append(term, description); detail.appendChild(row);
    }

    function prepareContextualFixtureFollowUp(promptTr, promptEn, contextLabel) {
        if (!queryInput) return;
        clearEvidenceFocus(); closeSourceDetails(); closeSources();
        queryInput.value = t(promptTr, promptEn); queryInput.dataset.followUp = 'fixture-only'; queryInput.dataset.followUpContext = contextLabel;
        queryInput.setAttribute('aria-describedby', 'assistantPrototypeToast'); queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        queryInput.focus({ preventScroll: true }); queryInput.setSelectionRange(queryInput.value.length, queryInput.value.length);
        showToast(`${contextLabel} için fixture-only takip sorusu hazırlandı. Live API çağrısı yapılmadı.`, `A FIXTURE-ONLY follow-up question was prepared for ${contextLabel}. No live API call was made.`);
    }

    function ensureSourceDetail(sourceCard, button) {
        let detail = sourceCard.querySelector('[data-source-detail]'); if (detail) return detail;
        const content = sourceCard.querySelector('.source-content'); if (!content) return null;
        detail = document.createElement('section'); detail.className = 'source-detail'; detail.dataset.sourceDetail = 'fixture-only';
        detail.id = `${sourceCard.id}-detail`; detail.hidden = true; detail.setAttribute('aria-label', t('Fixture kanıt ayrıntısı', 'Fixture evidence details'));
        const boundary = document.createElement('p'); boundary.className = 'source-detail-boundary';
        markTranslatable(boundary, 'Fixture-only · Yeni kaynak verisi getirmez ve bibliyografik doğrulama yapmaz.', 'FIXTURE-ONLY · Does not retrieve new source data and does not perform bibliographic verification.');
        const list = document.createElement('dl'); list.className = 'source-detail-list'; const labels = sourceFindingLabels(sourceCard);
        appendDetailField(list, 'Bulgu bağı', 'Finding link', labels.length ? labels.join(', ') : t('Özet', 'Summary'));
        appendDetailField(list, 'Kanıt ilişkisi', 'Evidence relationship', sourceCard.querySelector('.evidence-relation')?.textContent?.trim() || t('İlişki belirtilmedi.', 'Relationship not specified.'));
        appendDetailField(list, 'Fixture künyesi', 'Fixture citation', sourceCard.querySelector('.source-meta')?.textContent?.trim() || t('Metadata belirtilmedi.', 'Metadata not specified.'));
        appendDetailField(list, 'Kanıt sınıflaması', 'Evidence classification', [...sourceCard.querySelectorAll('.source-badges span')].map((badge) => badge.textContent?.trim()).filter(Boolean).join(' · ') || t('Sınıflama belirtilmedi.', 'Classification not specified.'));
        const followUp = document.createElement('button'); followUp.type = 'button'; followUp.className = 'assistant-secondary-btn source-context-followup'; followUp.dataset.fixtureOnly = 'true';
        markTranslatable(followUp, 'Bu kanıtı daha derin sor', 'Ask more deeply about this evidence');
        const sourceLabel = sourceCard.querySelector('.source-rank')?.textContent?.trim() || t('Bu kanıt', 'This evidence');
        followUp.setAttribute('aria-label', t(`${sourceLabel} için fixture-only takip sorusu hazırla`, `Prepare a fixture-only follow-up question for ${sourceLabel}`));
        followUp.addEventListener('click', () => prepareContextualFixtureFollowUp(`${sourceLabel} kanıtının bu bulgularla ilişkisini daha ayrıntılı açıkla.`, `Explain in more detail how ${sourceLabel} relates to these findings.`, sourceLabel));
        detail.append(boundary, list, followUp); content.appendChild(detail); button.setAttribute('aria-controls', detail.id); return detail;
    }

    function closeSourceDetails(except = null) {
        document.querySelectorAll('[data-source-detail]').forEach((detail) => { if (detail === except) return; detail.hidden = true; const owner = detail.closest('.source-card'); owner?.classList.remove('is-detail-open'); owner?.querySelector('.source-action')?.setAttribute('aria-expanded', 'false'); });
    }

    function markRelatedFindings(sourceId) { relatedFindingsForSource(sourceId).forEach((finding) => { finding.classList.add('is-evidence-active'); finding.setAttribute('aria-pressed', 'true'); }); }

    function highlightSource(sourceId, { preserveRelated = false } = {}) {
        const target = document.getElementById(sourceId); if (!target) return; if (!preserveRelated) clearEvidenceFocus();
        target.classList.add('is-highlighted', 'is-related'); markRelatedFindings(sourceId); openSources(); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.focus({ preventScroll: true });
        window.clearTimeout(highlightSource.timer); highlightSource.timer = window.setTimeout(() => target.classList.remove('is-highlighted'), 3200);
    }

    function toggleSourceDetail(button) {
        const sourceCard = button.closest('.source-card'); if (!sourceCard?.id) return; const detail = ensureSourceDetail(sourceCard, button); if (!detail) return;
        const opening = detail.hidden; closeSourceDetails(opening ? detail : null); detail.hidden = !opening; button.setAttribute('aria-expanded', opening ? 'true' : 'false'); sourceCard.classList.toggle('is-detail-open', opening);
        if (opening) { highlightSource(sourceCard.id); showToast('Fixture kanıt ayrıntısı açıldı; live kaynak verisi kullanılmıyor.', 'Fixture evidence details opened; no live source data is being used.'); }
    }

    function focusFindingEvidence(finding) {
        const sourceIds = [...finding.querySelectorAll('.citation-chip[data-source]')].map((chip) => chip.dataset.source).filter((sourceId, index, all) => sourceId && all.indexOf(sourceId) === index); if (!sourceIds.length) return;
        clearEvidenceFocus(); finding.classList.add('is-evidence-active'); finding.setAttribute('aria-pressed', 'true'); sourceIds.forEach((sourceId) => document.getElementById(sourceId)?.classList.add('is-related')); openSources();
        const firstSource = document.getElementById(sourceIds[0]); firstSource?.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstSource?.focus({ preventScroll: true });
        showToast(`${sourceIds.length} kanıt kaydı bu bulguyla ilişkilendirildi.`, `${sourceIds.length} evidence records are linked to this finding.`);
    }

    function beginFixtureFollowUp() {
        if (!queryInput) return; clearEvidenceFocus(); closeSourceDetails(); closeSources(); queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); queryInput.focus({ preventScroll: true }); queryInput.setSelectionRange(queryInput.value.length, queryInput.value.length);
        queryInput.dataset.followUp = 'fixture-only'; delete queryInput.dataset.followUpContext; queryInput.setAttribute('aria-describedby', 'assistantPrototypeToast');
        showToast('Takip sorunuzu yukarıdaki alana yazın. Çalıştırma yalnız fixture lifecycle kullanır; live API çağrısı yapılmaz.', 'Enter your follow-up question above. Execution uses the fixture lifecycle only; no live API call is made.');
    }

    function addFindingContextualFollowUps() {
        document.querySelectorAll('.finding-item').forEach((finding) => {
            if (finding.querySelector('[data-context-followup]')) return; const label = finding.querySelector('.finding-index')?.textContent?.trim(); const headingTr = finding.querySelector('h4')?.dataset.assistantTr || finding.querySelector('h4')?.textContent?.trim(); const headingEn = finding.querySelector('h4')?.dataset.en || headingTr; if (!label || !headingTr) return;
            const button = document.createElement('button'); button.type = 'button'; button.className = 'assistant-secondary-btn finding-context-followup'; button.dataset.contextFollowup = 'fixture-only'; markTranslatable(button, 'Derinleştir', 'Explore further');
            button.setAttribute('aria-label', t(`${label} bulgusu için fixture-only takip sorusu hazırla`, `Prepare a fixture-only follow-up question for finding ${label}`));
            button.addEventListener('click', (event) => { event.stopPropagation(); prepareContextualFixtureFollowUp(`${label} bulgusunu daha derin açıkla: ${headingTr}`, `Explain finding ${label} in more depth: ${headingEn}`, label); });
            button.addEventListener('keydown', (event) => event.stopPropagation()); finding.querySelector('div')?.appendChild(button);
        });
    }

    function setLoadingUi(isLoading) { if (demoSearchButton) { demoSearchButton.disabled = isLoading; demoSearchButton.setAttribute('aria-busy', isLoading ? 'true' : 'false'); } if (queryInput) queryInput.readOnly = isLoading; answerCard?.classList.toggle('is-loading', isLoading); }

    function clearLiveContent() {
        document.querySelector('[data-live-assistant-content]')?.remove();
        document.querySelectorAll('[data-live-evidence]').forEach((node) => node.remove());
    }

    function removeFixtureResult() {
        document.querySelectorAll('.assistant-answer-card > :not([data-live-assistant-content])').forEach((node) => {
            node.remove();
        });
        document.querySelectorAll('#assistantSources > .source-card:not([data-live-evidence]), #assistantSources > .sources-intro').forEach((node) => {
            node.remove();
        });
        const overview = document.querySelector('.evidence-overview');
        if (overview) overview.remove();
    }

    function resetLiveResult() {
        clearLiveContent();
        removeFixtureResult();
        const sourceCount = sourcePanel?.querySelector('.source-count');
        if (sourceCount) sourceCount.textContent = '0';
    }

    function setInitialLiveState() {
        resetLiveResult();
        answerCard?.classList.add('is-unavailable');
        if (answerCard) answerCard.style.opacity = '.58';
        setStatus({
            title: 'Araştırmaya hazır',
            titleEn: 'Ready to research',
            message: 'Bir araştırma sorusu girin. Doğrulanmış canlı sonuç hazır olduğunda burada gösterilecektir.',
            messageEn: 'Enter a research question. A verified live result will be shown here when available.',
            tone: 'info',
            marker: 'Live API',
            markerEn: 'Live API',
            state: 'ready-live'
        });
    }

    function evidenceLabel(item, index) {
        return `E${index + 1}`;
    }

    function renderLiveAssistantResult(result) {
        if (!answerCard || !Array.isArray(result?.claims) || !Array.isArray(result?.evidence)) return false;

        clearLiveContent();
        const evidenceById = new Map(result.evidence.map((item, index) => [
            item.evidence_id,
            { item, label: evidenceLabel(item, index) }
        ]));

        const live = document.createElement('section');
        live.dataset.liveAssistantContent = 'true';
        live.className = 'assistant-summary';

        const heading = document.createElement('h3');
        markTranslatable(heading, 'Kanıta dayalı bulgular', 'Evidence-grounded findings');
        live.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'assistant-findings';

        result.claims.forEach((claim, index) => {
            const finding = document.createElement('div');
            finding.className = 'finding-item';

            const badge = document.createElement('span');
            badge.className = 'finding-index';
            badge.textContent = `F${index + 1}`;

            const body = document.createElement('div');
            const text = document.createElement('p');
            text.textContent = String(claim?.text || '');
            body.appendChild(text);

            const verified = document.createElement('span');
            verified.className = 'verified-contract-badge';
            verified.dataset.verificationState = 'checker-passed';
            markTranslatable(verified, 'Doğrulandı · checker sözleşmesini geçti', 'Verified · passed checker contract');
            body.appendChild(verified);

            (claim?.evidence_ids || []).forEach((id) => {
                const linked = evidenceById.get(id);
                if (!linked) return;
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'citation-chip';
                chip.dataset.source = `live-${id}`;
                chip.textContent = linked.label;
                chip.setAttribute('aria-label', t(`${linked.label} kanıtını göster`, `Show evidence ${linked.label}`));
                chip.addEventListener('click', (event) => {
                    event.stopPropagation();
                    highlightSource(`live-${id}`);
                });
                body.appendChild(document.createTextNode(' '));
                body.appendChild(chip);
            });

            finding.append(badge, body);
            const linkedCount = finding.querySelectorAll('.citation-chip[data-source]').length;
            if (linkedCount) {
                finding.tabIndex = 0;
                finding.setAttribute('role', 'button');
                finding.setAttribute('aria-pressed', 'false');
                finding.setAttribute('aria-label', t(`F${index + 1} için ${linkedCount} ilişkili kanıt kaydını göster`, `Show ${linkedCount} related evidence records for F${index + 1}`));
                finding.addEventListener('click', (event) => { if (!event.target.closest('.citation-chip')) focusFindingEvidence(finding); });
                finding.addEventListener('keydown', (event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); focusFindingEvidence(finding); });
            }
            list.appendChild(finding);
        });

        live.appendChild(list);
        answerCard.prepend(live);

        const sourcePanelBody = sourcePanel;
        sourcePanelBody?.querySelectorAll('[data-live-evidence]').forEach((node) => node.remove());
        const sourceCount = sourcePanelBody?.querySelector('.source-count');
        if (sourceCount) sourceCount.textContent = String(result.evidence.length);
        const reviewedCount = answerCard.querySelector('.assistant-answer-meta strong');
        if (reviewedCount) reviewedCount.textContent = String(result.evidence.length);

        result.evidence.forEach((item, index) => {
            const card = document.createElement('article');
            card.className = 'source-card';
            card.dataset.liveEvidence = 'true';
            card.id = `live-${item.evidence_id}`;

            const rank = document.createElement('div');
            rank.className = 'source-rank';
            rank.textContent = evidenceLabel(item, index);

            const content = document.createElement('div');
            content.className = 'source-content';
            const title = document.createElement('h3');
            title.textContent = item.title || item.work_id || evidenceLabel(item, index);
            const meta = document.createElement('p');
            meta.className = 'source-meta';
            const authorNames = Array.isArray(item.authors) ? item.authors.map((a) => a?.name).filter(Boolean) : [];
            const authors = authorNames.length > 3 ? `${authorNames[0]} et al.` : authorNames.join(', ');
            const venue = String(item.venue?.name || '').trim();
            const year = bibliographicYear(item);
            meta.textContent = [authors, venue, year].filter(Boolean).join(' · ');
            content.append(title, meta);

            const badges = document.createElement('div');
            badges.className = 'source-badges';
            const evidenceLevel = String(item.evidence?.level || '').trim();
            if (['FULL_TEXT', 'ABSTRACT', 'METADATA_ONLY'].includes(evidenceLevel)) {
                const levelBadge = document.createElement('span');
                levelBadge.dataset.evidenceLevel = evidenceLevel;
                levelBadge.textContent = evidenceLevel.replace('_', ' ');
                badges.appendChild(levelBadge);
            }
            if (badges.childElementCount) content.appendChild(badges);

            if (item.abstract) {
                const abstract = document.createElement('p');
                abstract.textContent = item.abstract;
                content.appendChild(abstract);
            }

            const links = [
                { label: 'DOI', url: item.urls?.doi || (item.doi ? `https://doi.org/${item.doi}` : null) },
                { label: t('Yayıncı', 'Publisher'), url: item.urls?.publisher },
                { label: t('Açık tam metin', 'Open full text'), url: item.urls?.openAccess }
            ].filter(({ url }, index, all) => {
                if (!url) return false;
                try {
                    const parsed = new URL(url);
                    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
                    return all.findIndex((candidate) => candidate.url === url) === index;
                } catch {
                    return false;
                }
            });
            if (links.length) {
                const actions = document.createElement('div');
                actions.className = 'live-source-links';
                links.forEach(({ label, url }) => {
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.target = '_blank';
                    anchor.rel = 'noopener noreferrer';
                    anchor.textContent = label;
                    actions.appendChild(anchor);
                });
                content.appendChild(actions);
            }
            card.append(rank, content);
            sourcePanelBody?.appendChild(card);
        });

        removeFixtureResult();
        const overview = document.createElement('div');
        overview.className = 'evidence-overview';
        overview.dataset.liveEvidenceOverview = 'true';
        const appendMetric = (value, trLabel, enLabel) => {
            const metric = document.createElement('div');
            const metricValue = document.createElement('strong');
            metricValue.textContent = String(value);
            const metricLabel = document.createElement('span');
            markTranslatable(metricLabel, trLabel, enLabel);
            metric.append(metricValue, metricLabel);
            overview.appendChild(metric);
        };
        const summary = result.research_summary;
        const literature = summary?.literature;
        const verification = summary?.verification;
        if (literature && verification) {
            overview.dataset.researchSummary = 'true';
            appendMetric(literature.retrieved_count, 'bulunan çalışma', 'works found');
            appendMetric(literature.authorized_relevant_count, 'uygun kanıt kaydı', 'eligible evidence records');
            appendMetric(literature.abstract_bearing_count, 'özet içeren kayıt', 'records with abstracts');
            appendMetric(literature.metadata_only_count, 'yalnız metadata', 'metadata-only records');
            appendMetric(verification.checked_count, 'kontrol edilen iddia', 'claims checked');
            appendMetric(verification.verified_count, 'doğrulanan bulgu', 'verified findings');
            if (Number(verification.truncated_count) > 0) {
                appendMetric(verification.truncated_count, 'sınır nedeniyle kontrol edilmedi', 'not checked due to request limit');
            }
        } else {
            appendMetric(result.evidence.length, 'kullanılan kanıt', 'evidence cited');
            appendMetric(result.claims.length, 'doğrulanan bulgu', 'verified findings');
        }
        answerCard.appendChild(overview);
        answerCard.classList.remove('is-unavailable');
        answerCard.style.opacity = '1';
        return true;
    }

    function renderMappedState(result) {
        const mapped = mapAssistantResult(result);
        setStatus({ title: mapped.title, titleEn: mapped.titleEn, message: mapped.message, messageEn: mapped.messageEn, tone: mapped.tone, marker: mapped.evidencePackId ? 'EvidencePack hazır' : '', markerEn: mapped.evidencePackId ? 'EvidencePack ready' : '', state: mapped.state });
        const isSuccess = mapped.state === 'success'; answerCard?.classList.toggle('is-unavailable', !isSuccess); if (answerCard) answerCard.style.opacity = isSuccess ? '1' : '.58'; if (!isSuccess) { resetLiveResult(); clearEvidenceFocus(); closeSourceDetails(); closeSources(); } return mapped;
    }

    async function runLiveResearch() {
        const query = queryInput?.value?.trim() || '';
        if (query.length < 2 || query.length > 300) {
            renderMappedState({ ok: false, code: 'ASSISTANT_QUERY_INVALID', claims: [] });
            queryInput?.focus();
            return;
        }

        setLoadingUi(true);
        resetLiveResult();
        clearEvidenceFocus();
        closeSourceDetails();
        closeSources();
        if (answerCard) answerCard.style.opacity = '.58';

        try {
            const stage = loadingStage(0);
            setStatus({ title: stage.title, titleEn: stage.titleEn, message: stage.message, messageEn: stage.messageEn, tone: 'loading', marker: 'Live API', markerEn: 'Live API', state: 'loading-live' });

            const response = await fetch('/api/assistant/ask', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query })
            });

            let result;
            try {
                result = await response.json();
            } catch {
                result = { ok: false, code: 'UI_RENDER_FAILED', claims: [] };
            }

            const mapped = mapLiveAssistantResult(result);
            renderMappedState(result?.ok === true && result?.code === 'OK' && !Array.isArray(result?.evidence)
                ? { ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [] }
                : result);

            if (mapped.state === 'success') {
                if (renderLiveAssistantResult(result)) {
                    showToast('Canlı iddialar ve bağlı EvidencePack kaynakları gösteriliyor.', 'Live claims and their linked EvidencePack sources are shown.');
                } else {
                    renderMappedState({ ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [] });
                }
            }
        } catch (error) {
            console.error('Assistant live request failed:', error);
            renderMappedState({ ok: false, code: 'UI_RENDER_FAILED', claims: [] });
        } finally {
            setLoadingUi(false);
        }
    }


    function closeHistory() {
        if (historyPanel) historyPanel.hidden = true;
    }

    function historyRow(item) {
        const row = document.createElement('div');
        row.className = 'source-card assistant-history-item';

        const content = document.createElement('div');
        content.className = 'source-content';
        const title = document.createElement('h3');
        title.textContent = item.query || t('Kaydedilmiş araştırma', 'Saved research');
        const meta = document.createElement('p');
        meta.className = 'source-meta';
        meta.textContent = item.created_at ? new Date(item.created_at).toLocaleString() : '';

        const open = document.createElement('button');
        open.type = 'button'; open.className = 'source-action';
        open.textContent = t('Aç', 'Open');
        open.addEventListener('click', async () => {
            const response = await fetch('/api/assistant/history/' + encodeURIComponent(item.id), { credentials: 'same-origin' });
            if (!response.ok) { showToast('Geçmiş kaydı açılamadı.', 'Saved research could not be opened.'); return; }
            const saved = await response.json();
            if (queryInput) queryInput.value = saved.query || '';
            resetLiveResult(); clearEvidenceFocus(); closeSourceDetails(); closeSources(); closeHistory();
            renderMappedState(saved.result);
            if (!renderLiveAssistantResult(saved.result)) {
                renderMappedState({ ok: false, code: 'EVIDENCE_PAYLOAD_REQUIRED', claims: [] });
                return;
            }
            showToast('Kaydedilmiş araştırma açıldı; yeniden çalıştırılmadı.', 'Saved research opened without re-running it.');
        });

        const remove = document.createElement('button');
        remove.type = 'button'; remove.className = 'source-action';
        remove.textContent = t('Kalıcı sil', 'Delete permanently');
        remove.addEventListener('click', async () => {
            const response = await fetch('/api/assistant/history/' + encodeURIComponent(item.id), { method: 'DELETE', credentials: 'same-origin' });
            if (!response.ok) { showToast('Kayıt silinemedi.', 'Saved research could not be deleted.'); return; }
            row.remove();
            showToast('Kayıt kalıcı olarak silindi.', 'Saved research permanently deleted.');
        });

        content.append(title, meta, open, remove); row.appendChild(content);
        return row;
    }

    async function openHistory() {
        if (!historyPanel || !historyList) return;
        historyPanel.hidden = false;
        historyList.replaceChildren();
        try {
            const response = await fetch('/api/assistant/history', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('history unavailable');
            const payload = await response.json();
            const items = Array.isArray(payload.items) ? payload.items : [];
            if (!items.length) {
                const empty = document.createElement('p');
                empty.textContent = t('Henüz kaydedilmiş araştırmanız yok.', 'You have no saved research yet.');
                historyList.appendChild(empty);
                return;
            }
            items.forEach((item) => historyList.appendChild(historyRow(item)));
        } catch {
            const error = document.createElement('p');
            error.textContent = t('Geçmiş şu anda yüklenemiyor.', 'History is unavailable right now.');
            historyList.appendChild(error);
        }
    }

    function bindFindingEvidenceInteractions() {
        document.querySelectorAll('.finding-item').forEach((finding) => {
            const sourceCount = finding.querySelectorAll('.citation-chip[data-source]').length; if (!sourceCount) return; finding.tabIndex = 0; finding.setAttribute('role', 'button'); finding.setAttribute('aria-pressed', 'false'); finding.setAttribute('aria-label', t(`Bulgu için ${sourceCount} ilişkili kanıt kaydını göster`, `Show ${sourceCount} related evidence records for this finding`));
            finding.addEventListener('click', (event) => { if (!event.target.closest('.citation-chip, [data-context-followup]')) focusFindingEvidence(finding); }); finding.addEventListener('keydown', (event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); focusFindingEvidence(finding); });
        });
    }

    markResearchGapsFixtureOnly(); addFindingContextualFollowUps(); bindFindingEvidenceInteractions(); setInitialLiveState();
    document.querySelectorAll('.assistant-mode').forEach((button) => { if (button.dataset.mode !== 'ask') markComingSoon(button); });
    document.querySelectorAll('.assistant-filter').forEach(markComingSoon);
    document.querySelectorAll('.assistant-answer-actions button:not(#viewSourcesBtn):not(#assistantHistoryBtn):not(.assistant-primary-btn)').forEach(markComingSoon);
    document.querySelectorAll('.finding-context-followup, .source-context-followup').forEach(markComingSoon);
    document.querySelectorAll('.citation-chip[data-source]').forEach((button) => button.addEventListener('click', () => highlightSource(button.dataset.source)));
    document.getElementById('viewSourcesBtn')?.addEventListener('click', openSources);
    document.getElementById('assistantHistoryBtn')?.addEventListener('click', openHistory);
    document.getElementById('closeAssistantHistoryBtn')?.addEventListener('click', closeHistory);
    document.getElementById('closeSourcesBtn')?.addEventListener('click', () => { closeSourceDetails(); closeSources(); });
    document.querySelectorAll('.assistant-mode').forEach((button) => button.addEventListener('click', () => {
        document.querySelectorAll('.assistant-mode').forEach((item) => item.classList.remove('active')); button.classList.add('active');
        if (button.dataset.mode === 'gaps') { showToast('Araştırma boşlukları şimdilik fixture-only. Live gap verisi için ayrı, minimize edilmiş API contract review gereklidir.', 'Research gaps are FIXTURE-ONLY for now. Live gap data requires a separate, minimized API contract review.'); return; }
        if (button.dataset.mode !== 'ask') showToast('Bu mod prototipte yalnızca görsel olarak gösteriliyor. İlk sürümde “Sor” deneyimini tamamlayacağız.', 'This mode is visual-only in the prototype. The first release will complete the “Ask” experience.');
    }));
    demoSearchButton?.addEventListener('click', runLiveResearch);
    document.querySelectorAll('.source-action').forEach((button) => { button.setAttribute('aria-expanded', 'false'); button.addEventListener('click', () => toggleSourceDetail(button)); });
    document.querySelector('.assistant-answer-actions .assistant-primary-btn')?.addEventListener('click', beginFixtureFollowUp);
    document.querySelectorAll('.assistant-answer-actions button:not(#viewSourcesBtn):not(#assistantHistoryBtn):not(.assistant-primary-btn)').forEach((button) => { if (!button.disabled) button.addEventListener('click', () => showToast('Bu aksiyon sonraki UI iterasyonunda etkinleştirilecek.', 'This action will be enabled in a later UI iteration.')); });
    document.querySelectorAll('.assistant-filter').forEach((button) => button.addEventListener('click', () => showToast('Filtre kontrolleri prototipte pasif; backend bağlantısı yapılmadı.', 'Filter controls are inactive in the prototype; no backend connection has been made.')));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { clearEvidenceFocus(); closeSourceDetails(); closeSources(); } });
}).catch((error) => { console.error('Assistant UI state module failed to load:', error); });
