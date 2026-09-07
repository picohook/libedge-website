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

    const nav = hamburger.closest('nav.nav-glass');
    const navRow = navLinks.parentElement;
    const placeholder = document.createElement('span');
    placeholder.hidden = true;
    placeholder.dataset.navLinksPlaceholder = 'true';
    navRow.insertBefore(placeholder, navLinks);

    function closeMobileMenu() {
        navLinks.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        const icon = hamburger.querySelector('i');
        if (icon) icon.className = 'fas fa-bars';
        document.documentElement.classList.remove('menu-open');
        document.body.classList.remove('menu-open');
        document.querySelectorAll('.nav-links .group').forEach(group => group.classList.remove('active'));
    }

    function syncMobileMenuPlacement() {
        const isMobile = window.innerWidth <= 639;

        if (isMobile) {
            if (navLinks.parentElement !== document.body) {
                document.body.appendChild(navLinks);
            }
            navLinks.dataset.mobileOffcanvas = 'true';
            return;
        }

        closeMobileMenu();
        if (placeholder.parentElement && navLinks.parentElement !== navRow) {
            placeholder.after(navLinks);
        }
        delete navLinks.dataset.mobileOffcanvas;
    }

    syncMobileMenuPlacement();
    navLinks.classList.remove('active');

    hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        const willOpen = !navLinks.classList.contains('active');

        if (window.innerWidth <= 639 && navLinks.parentElement !== document.body) {
            document.body.appendChild(navLinks);
        }

        navLinks.classList.toggle('active', willOpen);
        this.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        const icon = this.querySelector('i');
        if (icon) icon.className = willOpen ? 'fas fa-times' : 'fas fa-bars';
        document.documentElement.classList.toggle('menu-open', willOpen);
        document.body.classList.toggle('menu-open', willOpen);

        if (!willOpen) {
            document.querySelectorAll('.nav-links .group').forEach(group => group.classList.remove('active'));
        }
    });

    navLinks.querySelectorAll('.group').forEach(group => {
        const dropdownLink = group.querySelector('a');
        if (!dropdownLink || dropdownLink.dataset.headerInitialized === 'true') return;

        dropdownLink.dataset.headerInitialized = 'true';
        dropdownLink.addEventListener('click', function(e) {
            if (window.innerWidth <= 639 && group.querySelector('.dropdown')) {
                e.preventDefault();
                e.stopPropagation();
                const wasActive = group.classList.contains('active');
                navLinks.querySelectorAll('.group').forEach(other => other.classList.remove('active'));
                if (!wasActive) group.classList.add('active');
            }
        });
    });

    if (!document.body.dataset.navOutsideClickBound) {
        document.body.dataset.navOutsideClickBound = 'true';
        document.addEventListener('click', function(e) {
            const currentNavLinks = document.querySelector('.nav-links');
            if (currentNavLinks && currentNavLinks.classList.contains('active') &&
                !e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
                closeMobileMenu();
            }
        });
    }

    if (!window.__headerResizeBound) {
        window.__headerResizeBound = true;
        window.addEventListener('resize', syncMobileMenuPlacement);
    }

    navLinks.querySelectorAll('.dropdown a').forEach(link => {
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
                closeMobileMenu();
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

// Scroll effects: nav glass + hero shrink
(function() {
    if (window.__scrollEffectsInit) return;
    window.__scrollEffectsInit = true;

    function getHeaderHeight() {
        const header = document.querySelector('#site-header header');
        return header ? header.offsetHeight : 80;
    }

    function onScroll() {
        const scrollY = window.scrollY;
        const threshold = getHeaderHeight();

        // Nav: saydam cam olur — header geçildikten sonra
        const nav = document.querySelector('nav.nav-glass');
        if (nav) nav.classList.toggle('nav-scrolled', scrollY > threshold);

        // Hero: kaydırınca küçülür
        const hero = document.querySelector('.hero-slider-container');
        if (hero) {
            if (scrollY <= 0) {
                hero.style.transform = '';
            } else {
                const t = Math.min(1, scrollY / 400);
                hero.style.transform = 'scale(' + (1 - t * 0.18).toFixed(3) + ')';
            }
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
})();

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
