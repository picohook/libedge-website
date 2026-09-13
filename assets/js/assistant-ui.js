(() => {
    'use strict';

    const sourcePanel = document.getElementById('assistantSources');
    const toast = document.getElementById('assistantPrototypeToast');
    const status = document.getElementById('assistantStatus');
    const queryInput = document.getElementById('assistantQuery');

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
        if (!sourcePanel) return;
        sourcePanel.classList.add('is-open');
    }

    function closeSources() {
        if (!sourcePanel) return;
        sourcePanel.classList.remove('is-open');
    }

    function highlightSource(sourceId) {
        const target = document.getElementById(sourceId);
        if (!target) return;

        document.querySelectorAll('.source-card.is-highlighted').forEach((card) => {
            card.classList.remove('is-highlighted');
        });

        target.classList.add('is-highlighted');
        openSources();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });

        window.clearTimeout(highlightSource.timer);
        highlightSource.timer = window.setTimeout(() => {
            target.classList.remove('is-highlighted');
        }, 3200);
    }

    document.querySelectorAll('.citation-chip[data-source]').forEach((button) => {
        button.addEventListener('click', () => highlightSource(button.dataset.source));
    });

    document.getElementById('viewSourcesBtn')?.addEventListener('click', openSources);
    document.getElementById('closeSourcesBtn')?.addEventListener('click', closeSources);

    document.querySelectorAll('.assistant-mode').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.assistant-mode').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            if (button.dataset.mode !== 'ask') {
                showToast('Bu mod prototipte yalnızca görsel olarak gösteriliyor. İlk sürümde “Sor” deneyimini tamamlayacağız.');
            }
        });
    });

    document.getElementById('assistantDemoSearch')?.addEventListener('click', () => {
        const query = queryInput?.value?.trim() || '';
        if (query.length < 2) {
            showToast('Lütfen en az 2 karakterlik bir araştırma sorusu girin.');
            queryInput?.focus();
            return;
        }
        if (status) {
            status.classList.remove('success');
            status.classList.add('info');
            status.querySelector('strong').textContent = 'Prototip modu';
            status.querySelector('span:not(.assistant-status-time)').textContent = 'Bu PR gerçek /api/assistant/ask çağrısı yapmaz; aşağıdaki yanıt fixture verisidir.';
        }
        showToast('UI prototipi: gerçek retrieval veya model çağrısı yapılmadı.');
    });

    document.querySelectorAll('.source-action').forEach((button) => {
        button.addEventListener('click', () => {
            showToast('Kaynak detay görünümü sonraki UI iterasyonunda bağlanacak.');
        });
    });

    document.querySelectorAll('.assistant-answer-actions button:not(#viewSourcesBtn)').forEach((button) => {
        if (button.disabled) return;
        button.addEventListener('click', () => {
            showToast('Bu aksiyon sonraki UI iterasyonunda etkinleştirilecek.');
        });
    });

    document.querySelectorAll('.assistant-filter').forEach((button) => {
        button.addEventListener('click', () => {
            showToast('Filtre kontrolleri prototipte pasif; backend bağlantısı yapılmadı.');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeSources();
    });
})();
