// P2-A: accessible, filter-aware navigation from overview KPI cards to the corresponding admin sections.
(function () {
    'use strict';

    const KPI_LINKS = [
        { valueId: 'statUsers', tab: 'users', label: 'Kullanıcıları görüntüle' },
        { valueId: 'statSubscriptions', tab: 'subscriptions', label: 'Abonelikleri görüntüle' },
        { valueId: 'statInstitutions', tab: 'institutions', label: 'Kurumları görüntüle' },
        { valueId: 'statPublishedAnnouncements', tab: 'announcements', label: 'Duyuruları görüntüle' },
        {
            valueId: 'statPendingRequests',
            tab: 'requests',
            label: 'Bekleyen talepleri görüntüle',
            resetFilters: ['requestsTypeFilter', 'requestsStatusFilter'],
            filters: { requestsStatusFilter: 'pending' },
        },
        {
            valueId: 'statTrials',
            tab: 'requests',
            label: 'Deneme taleplerini görüntüle',
            resetFilters: ['requestsTypeFilter', 'requestsStatusFilter'],
            filters: { requestsTypeFilter: 'trial' },
        },
        { valueId: 'statTodayRegistrations', tab: 'users', label: 'Kullanıcı kayıtlarını görüntüle' },
    ];

    function applyFilters(resetFilters = [], filters = {}) {
        resetFilters.forEach((id) => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });

        Object.entries(filters).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.value = value;
        });
    }

    function openTab(tab, resetFilters, filters) {
        const link = document.querySelector(`.sidebar-link[data-tab="${tab}"]`);
        if (!link || link.offsetParent === null) return;
        applyFilters(resetFilters, filters);
        link.click();
    }

    function addHint(card, label) {
        const content = card.querySelector(':scope > div');
        if (!content || content.querySelector('[data-dashboard-kpi-hint]')) return;

        const hint = document.createElement('span');
        hint.dataset.dashboardKpiHint = 'true';
        hint.className = 'text-xs font-medium text-indigo-600 mt-2 inline-flex items-center gap-1';
        hint.textContent = `${label} →`;
        content.appendChild(hint);
    }

    function bindCard({ valueId, tab, label, resetFilters, filters }) {
        const value = document.getElementById(valueId);
        const card = value?.closest('.stat-card');
        if (!card || card.id === 'systemHealthCard' || card.dataset.dashboardNavBound === 'true') return;

        card.dataset.dashboardNavBound = 'true';
        card.dataset.dashboardTargetTab = tab;
        card.setAttribute('role', 'link');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', label);
        card.title = label;
        card.classList.add('cursor-pointer', 'transition', 'hover:shadow-md', 'hover:ring-1', 'hover:ring-indigo-200');
        addHint(card, label);

        const activate = () => openTab(tab, resetFilters, filters);
        card.addEventListener('click', (event) => {
            if (event.target.closest('button, a, input, select, textarea')) return;
            activate();
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activate();
            }
        });
    }

    function init() {
        KPI_LINKS.forEach(bindCard);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
