// P2-A: accessible, filter-aware navigation from overview KPI cards, action-required items, and activity feed to admin sections.
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

    const ACTION_LINKS = {
        pending_requests: {
            tab: 'requests',
            resetFilters: ['requestsTypeFilter', 'requestsStatusFilter'],
            filters: { requestsStatusFilter: 'pending' },
            label: 'Bekleyen talepleri görüntüle',
        },
        users_without_institution: {
            tab: 'users',
            resetFilters: ['userSearchInput', 'userRoleFilter', 'userInstitutionFilter'],
            label: 'Kurumsuz kullanıcıları yönet',
        },
        expiring_subscriptions: {
            tab: 'subscriptions',
            resetFilters: ['subscriptionSearchInput', 'subscriptionTypeFilter', 'subscriptionStatusFilter'],
            label: 'Yakında bitecek abonelikleri yönet',
        },
    };

    const ACTIVITY_LINKS = {
        user: {
            tab: 'users',
            resetFilters: ['userSearchInput', 'userRoleFilter', 'userInstitutionFilter'],
            searchId: 'userSearchInput',
            label: 'Kullanıcı kaydını görüntüle',
        },
        institution: {
            tab: 'institutions',
            resetFilters: ['institutionSearchInput', 'institutionOrgFilter', 'institutionStatusFilter'],
            searchId: 'institutionSearchInput',
            label: 'Kurum kaydını görüntüle',
        },
        announcement: {
            tab: 'announcements',
            label: 'Duyuruları görüntüle',
        },
        subscription: {
            tab: 'subscriptions',
            resetFilters: ['subscriptionSearchInput', 'subscriptionTypeFilter', 'subscriptionStatusFilter'],
            searchId: 'subscriptionSearchInput',
            label: 'Abonelikleri görüntüle',
        },
        institution_subscription: {
            tab: 'subscriptions',
            resetFilters: ['subscriptionSearchInput', 'subscriptionTypeFilter', 'subscriptionStatusFilter'],
            searchId: 'subscriptionSearchInput',
            label: 'Kurum aboneliklerini görüntüle',
        },
    };

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

    function bindActionRows(items = []) {
        const container = document.getElementById('dashboardActions');
        if (!container) return;

        const visibleItems = (items || []).filter(item => item.count > 0 || item.key === 'pending_requests');
        Array.from(container.children).forEach((row, index) => {
            const item = visibleItems[index];
            const config = ACTION_LINKS[item?.key];
            if (!item || !config || Number(item.count || 0) <= 0 || row.dataset.dashboardActionNavBound === 'true') return;

            row.dataset.dashboardActionNavBound = 'true';
            row.dataset.dashboardActionKey = item.key;
            row.dataset.dashboardTargetTab = config.tab;
            row.setAttribute('aria-label', config.label);
            row.title = config.label;

            const activate = (event) => {
                event?.preventDefault();
                event?.stopPropagation();
                openTab(config.tab, config.resetFilters, config.filters);
            };
            row.addEventListener('click', activate);
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') activate(event);
            });
        });
    }

    function wrapActionRenderer() {
        const original = window.renderDashboardActions;
        if (typeof original !== 'function' || original.dashboardNavWrapped) return;

        const wrapped = function (items) {
            const result = original.apply(this, arguments);
            bindActionRows(items);
            return result;
        };
        wrapped.dashboardNavWrapped = true;
        window.renderDashboardActions = wrapped;
    }

    function bindActivityRows(items = []) {
        const container = document.getElementById('dashboardActivityFeed');
        if (!container) return;

        Array.from(container.children).forEach((row, index) => {
            const item = items[index];
            const config = ACTIVITY_LINKS[item?.type];
            if (!item || !config || row.dataset.dashboardActivityNavBound === 'true') return;

            const filters = config.searchId && item.title
                ? { [config.searchId]: String(item.title) }
                : {};
            const label = `${config.label}: ${item.title || item.meta || ''}`.replace(/:\s*$/, '');

            row.dataset.dashboardActivityNavBound = 'true';
            row.dataset.dashboardTargetTab = config.tab;
            row.setAttribute('role', 'link');
            row.setAttribute('tabindex', '0');
            row.setAttribute('aria-label', label);
            row.title = label;
            row.classList.add('cursor-pointer', 'rounded-lg', 'transition', 'hover:bg-gray-50', 'focus:outline-none', 'focus:ring-2', 'focus:ring-indigo-200');

            const activate = () => openTab(config.tab, config.resetFilters, filters);
            row.addEventListener('click', activate);
            row.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate();
                }
            });
        });
    }

    function wrapActivityRenderer() {
        const original = window.renderDashboardActivity;
        if (typeof original !== 'function' || original.dashboardNavWrapped) return;

        const wrapped = function (items) {
            const result = original.apply(this, arguments);
            bindActivityRows(items);
            return result;
        };
        wrapped.dashboardNavWrapped = true;
        window.renderDashboardActivity = wrapped;
    }

    function init() {
        KPI_LINKS.forEach(bindCard);
        wrapActionRenderer();
        wrapActivityRenderer();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
