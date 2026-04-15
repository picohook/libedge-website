function initTranslateButtonSync() {
    const translateBtnMain = document.getElementById('translateBtn');
    const translateBtnNav = document.getElementById('translateBtnNav');
    const translateTextMain = document.getElementById('translateText');
    const translateTextNav = document.getElementById('translateTextNav');

    if (translateBtnMain && translateBtnNav && !translateBtnNav.dataset.syncBound) {
        translateBtnNav.dataset.syncBound = 'true';
        translateBtnNav.addEventListener('click', function() {
            translateBtnMain.click();
        });
    }

    function syncTranslateText() {
        if (translateTextMain && translateTextNav) {
            translateTextNav.textContent = translateTextMain.textContent;
        }
    }

    if (translateTextMain && translateTextNav && !translateTextMain.dataset.syncObserved) {
        const observer = new MutationObserver(syncTranslateText);
        observer.observe(translateTextMain, { childList: true, characterData: true, subtree: true });
        translateTextMain.dataset.syncObserved = 'true';
    }

    syncTranslateText();
}

function initHeaderInteractions() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (!hamburger || !navLinks) return;
    if (hamburger.dataset.headerInitialized === 'true') return;
    hamburger.dataset.headerInitialized = 'true';

    const dropdownGroups = document.querySelectorAll('.nav-links .group');
    navLinks.classList.remove('active');

    hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        navLinks.classList.toggle('active');
        const isActive = navLinks.classList.contains('active');
        this.setAttribute('aria-expanded', isActive ? 'true' : 'false');
        const icon = this.querySelector('i');
        if (icon) icon.className = isActive ? 'fas fa-times' : 'fas fa-bars';
        if (!isActive) dropdownGroups.forEach(group => group.classList.remove('active'));
    });

    dropdownGroups.forEach(group => {
        const dropdownLink = group.querySelector('a');
        if (!dropdownLink || dropdownLink.dataset.headerInitialized === 'true') return;

        dropdownLink.dataset.headerInitialized = 'true';
        dropdownLink.addEventListener('click', function(e) {
            if (window.innerWidth <= 639 && group.querySelector('.dropdown')) {
                e.preventDefault();
                e.stopPropagation();
                const wasActive = group.classList.contains('active');
                dropdownGroups.forEach(other => other.classList.remove('active'));
                if (!wasActive) group.classList.add('active');
            }
        });
    });

    if (!document.body.dataset.navOutsideClickBound) {
        document.body.dataset.navOutsideClickBound = 'true';
        document.addEventListener('click', function(e) {
            const currentNavLinks = document.querySelector('.nav-links');
            const currentHamburger = document.querySelector('.hamburger');
            const currentDropdownGroups = document.querySelectorAll('.nav-links .group');

            if (currentNavLinks && currentNavLinks.classList.contains('active') &&
                !e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
                currentNavLinks.classList.remove('active');
                if (currentHamburger) {
                    currentHamburger.setAttribute('aria-expanded', 'false');
                    currentHamburger.querySelector('i').className = 'fas fa-bars';
                }
                currentDropdownGroups.forEach(group => group.classList.remove('active'));
            }
        });
    }

    if (!window.__headerResizeBound) {
        window.__headerResizeBound = true;
        window.addEventListener('resize', () => {
            const currentNavLinks = document.querySelector('.nav-links');
            const currentHamburger = document.querySelector('.hamburger');
            const currentDropdownGroups = document.querySelectorAll('.nav-links .group');

            if (window.innerWidth > 639 && currentNavLinks && currentNavLinks.classList.contains('active')) {
                currentNavLinks.classList.remove('active');
                if (currentHamburger) {
                    currentHamburger.setAttribute('aria-expanded', 'false');
                    currentHamburger.querySelector('i').className = 'fas fa-bars';
                }
                currentDropdownGroups.forEach(group => group.classList.remove('active'));
            }
        });
    }

    document.querySelectorAll('.nav-links .dropdown a').forEach(link => {
        if (link.dataset.dropdownInitialized === 'true') return;

        link.dataset.dropdownInitialized = 'true';
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (!href) return;

            const url = new URL(href, window.location.href);
            const currentPath = window.location.pathname === '/' ? '/index.html' : window.location.pathname;
            const targetPath = url.pathname === '/' ? '/index.html' : url.pathname;
            if (targetPath !== currentPath || !url.hash) return;

            e.preventDefault();
            const targetId = url.hash.substring(1);
            const targetCard = document.getElementById(targetId);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const flipInner = targetCard.querySelector('.flip-inner');
                if (flipInner && !flipInner.classList.contains('flipped')) {
                    flipInner.classList.add('flipped');
                    setTimeout(() => flipInner.classList.remove('flipped'), 3000);
                }
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initTranslateButtonSync();
    initHeaderInteractions();
});

// Case A: header loaded after auth was already done
document.addEventListener('header:ready', function() {
    initTranslateButtonSync();
    initHeaderInteractions();

    if (window.authInitialized && typeof window.updateAuthUI === 'function') {
        window.updateAuthUI(!!window.currentUser);
    }
});

// Case B: auth finished after header was already mounted
document.addEventListener('auth:ready', function() {
    if (typeof window.updateAuthUI === 'function') {
        window.updateAuthUI(!!window.currentUser);
    }
});
