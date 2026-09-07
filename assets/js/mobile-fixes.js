/**
 * MOBİL UYUMLULUK DÜZELTMELERİ
 * Bu dosya script.js'ten SONRA yüklenmelidir.
 * Navigasyon aç/kapa davranışı yalnız header-controller.js tarafından yönetilir.
 */

(function() {
    'use strict';

    function updateViewportHeight() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    updateViewportHeight();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateViewportHeight, 100);
    });

    window.addEventListener('orientationchange', () => {
        setTimeout(updateViewportHeight, 50);
    });

    // Mobil menü davranışı artık burada yönetilmiyor.
    // Tek kaynak: assets/js/header-controller.js
    function enhanceMobileMenu() {}

    function enhanceFilterScroll() {
        const filterContainer = document.querySelector('.filter-container');
        if (!filterContainer) return;

        const container = filterContainer.closest('.subject-filter-container');
        if (!container || container.dataset.scrollEnhanced) return;
        container.dataset.scrollEnhanced = 'true';

        function updateScrollIndicator() {
            const hasOverflow = filterContainer.scrollWidth > filterContainer.clientWidth;
            const isScrolledToEnd = filterContainer.scrollLeft + filterContainer.clientWidth >= filterContainer.scrollWidth - 5;

            if (hasOverflow && !isScrolledToEnd) {
                container.classList.add('has-scroll');
            } else {
                container.classList.remove('has-scroll');
            }
        }

        filterContainer.addEventListener('scroll', updateScrollIndicator);
        window.addEventListener('resize', updateScrollIndicator);
        setTimeout(updateScrollIndicator, 100);
    }

    function adjustHeroHeight() {
        const heroContainer = document.querySelector('.hero-slider-container');
        if (!heroContainer) return;

        if (/iPhone|iPad|iPod/.test(navigator.userAgent) && window.innerWidth <= 768) {
            heroContainer.style.height = window.innerHeight + 'px';
        }
    }

    function detectSafeArea() {
        const testDiv = document.createElement('div');
        testDiv.style.padding = 'env(safe-area-inset-top)';
        document.body.appendChild(testDiv);

        const hasSafeArea = getComputedStyle(testDiv).paddingTop !== '0px';
        document.body.removeChild(testDiv);

        if (hasSafeArea) {
            document.documentElement.classList.add('has-safe-area');
        }
    }

    let resizeObserver;
    function initResizeObserver() {
        if (resizeObserver) return;

        resizeObserver = new ResizeObserver(() => {
            adjustHeroHeight();
        });

        const heroContainer = document.querySelector('.hero-slider-container');
        if (heroContainer) {
            resizeObserver.observe(heroContainer);
        }
    }

    function waitForHeader() {
        return new Promise((resolve) => {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks && navLinks.children.length > 0) {
                resolve();
                return;
            }

            document.addEventListener('header:ready', () => {
                setTimeout(resolve, 50);
            }, { once: true });

            setTimeout(resolve, 2000);
        });
    }

    async function init() {
        await waitForHeader();

        updateViewportHeight();
        detectSafeArea();
        adjustHeroHeight();
        initResizeObserver();

        enhanceMobileMenu();
        enhanceFilterScroll();

        window.addEventListener('orientationchange', () => {
            setTimeout(adjustHeroHeight, 100);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
