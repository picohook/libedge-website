/**
 * MOBİL UYUMLULUK DÜZELTMELERİ
 * Bu dosya script.js'ten SONRA yüklenmelidir
 * Mevcut fonksiyonları override ETMEZ, sadece mobil ek davranışlar ekler
 */

(function() {
    'use strict';
    
    console.log('📱 Mobile fixes loading...');

    // ========== VIEWPORT HEIGHT POLYFILL ==========
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

    // ========== MOBİL MENÜ - MEVCUT toggleDropdown'u KORU ==========
    function enhanceMobileMenu() {
        // Sadece mobilde çalış
        if (window.innerWidth >= 640) return;
        
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        
        if (!hamburger || !navLinks) {
            console.warn('⚠️ Hamburger veya nav-links bulunamadı');
            return;
        }

        // Mobil menü panelini viewport genişliğine zorla. Tailwind space-x ve
        // masaüstü hizalama sınıflarının paneli daraltmasını engeller.
        navLinks.style.width = '100vw';
        navLinks.style.maxWidth = '100vw';
        navLinks.style.left = '0';
        navLinks.style.right = 'auto';
        navLinks.style.boxSizing = 'border-box';
        navLinks.style.alignItems = 'stretch';
        navLinks.style.gap = '0';
        navLinks.style.paddingLeft = '1rem';
        navLinks.style.paddingRight = '1rem';

        Array.from(navLinks.children).forEach((child) => {
            child.style.width = '100%';
            child.style.maxWidth = '100%';
            child.style.marginLeft = '0';
            child.style.marginRight = '0';
            child.style.boxSizing = 'border-box';
        });
        
        // Overlay oluştur (yoksa)
        let overlay = document.querySelector('.nav-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            document.body.appendChild(overlay);
        }
        
        // Menü durumunu güncelle
        function updateMenuState(isOpen) {
            if (isOpen) {
                navLinks.classList.add('active');
                document.documentElement.classList.add('menu-open');
                document.body.classList.add('menu-open');
                hamburger.setAttribute('aria-expanded', 'true');
                
                // Hamburger ikonunu değiştir
                const icon = hamburger.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                }
                
                overlay.style.opacity = '1';
                overlay.style.visibility = 'visible';
            } else {
                navLinks.classList.remove('active');
                document.documentElement.classList.remove('menu-open');
                document.body.classList.remove('menu-open');
                hamburger.setAttribute('aria-expanded', 'false');
                
                // Hamburger ikonunu geri değiştir
                const icon = hamburger.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
                
                overlay.style.opacity = '0';
                overlay.style.visibility = 'hidden';
                
                // Tüm dropdown'ları kapat (mevcut toggleDropdown ile uyumlu)
                document.querySelectorAll('.nav-links .dropdown-list').forEach(list => {
                    list.classList.add('hidden');
                });
                document.querySelectorAll('.nav-links .group').forEach(g => {
                    g.classList.remove('active');
                });
            }
        }
        
        // Mevcut hamburger click event'ini override ETME, ek davranış ekle.
        if (!hamburger.dataset.mobileEnhanced) {
            hamburger.dataset.mobileEnhanced = 'true';
            hamburger.addEventListener('click', function() {
                setTimeout(() => {
                    const isActive = navLinks.classList.contains('active');
                    updateMenuState(isActive);
                }, 10);
            });
        }
        
        // Overlay tıklaması
        overlay.addEventListener('click', () => {
            navLinks.classList.remove('active');
            updateMenuState(false);
        });
        
        // ESC tuşu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                updateMenuState(false);
            }
        });
        
        // Link tıklandığında menüyü kapat (dropdown toggle hariç)
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                // Dropdown toggle butonları için menüyü kapatma
                const isDropdownToggle = link.closest('.group') && 
                    (link.hasAttribute('onclick') || 
                     link.querySelector('.fa-chevron-down'));
                
                if (!isDropdownToggle) {
                    setTimeout(() => {
                        navLinks.classList.remove('active');
                        updateMenuState(false);
                    }, 150);
                }
            });
        });
        
        console.log('✅ Mobil menü geliştirmeleri aktif');
    }

    // ========== MOBİL KART FLİP - MEVCUT FLİP İLE ÇAKIŞMAZ ==========

    // ========== FİLTRE SCROLL GÖSTERGESİ ==========
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
        
        // İlk yüklemede kontrol et
        setTimeout(updateScrollIndicator, 100);
        
        console.log('✅ Filtre scroll göstergesi aktif');
    }

    // ========== HERO SLIDER YÜKSEKLİK AYARI ==========
    function adjustHeroHeight() {
        const heroContainer = document.querySelector('.hero-slider-container');
        if (!heroContainer) return;
        
        // iOS Safari için
        if (/iPhone|iPad|iPod/.test(navigator.userAgent) && window.innerWidth <= 768) {
            heroContainer.style.height = window.innerHeight + 'px';
        }
    }

    // ========== SAFE AREA DETECTION ==========
    function detectSafeArea() {
        const testDiv = document.createElement('div');
        testDiv.style.padding = 'env(safe-area-inset-top)';
        document.body.appendChild(testDiv);
        
        const hasSafeArea = getComputedStyle(testDiv).paddingTop !== '0px';
        document.body.removeChild(testDiv);
        
        if (hasSafeArea) {
            document.documentElement.classList.add('has-safe-area');
            console.log('✅ Safe area detected');
        }
    }

    // ========== RESİZE OBSERVER ==========
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

    // ========== HEADER READY EVENT'İNİ DİNLE ==========
    function waitForHeader() {
        return new Promise((resolve) => {
            // Header zaten yüklü mü?
            const navLinks = document.querySelector('.nav-links');
            if (navLinks && navLinks.children.length > 0) {
                resolve();
                return;
            }
            
            // Header:ready event'ini bekle
            document.addEventListener('header:ready', () => {
                console.log('📡 Header hazır, mobil geliştirmeler başlatılıyor...');
                setTimeout(resolve, 50);
            }, { once: true });
            
            // Timeout fallback
            setTimeout(resolve, 2000);
        });
    }

    // ========== TÜM FONKSİYONLARI BAŞLAT ==========
    async function init() {
        console.log('📱 Mobile fixes initializing...');
        
        // Header'ın yüklenmesini bekle (header.js async çalışıyor)
        await waitForHeader();
        
        // Temel fonksiyonlar (header beklemez)
        updateViewportHeight();
        detectSafeArea();
        adjustHeroHeight();
        initResizeObserver();
        
        // Header bağımlı fonksiyonlar
        enhanceMobileMenu();
        enhanceFilterScroll();
        
        // Oryantasyon değişiminde menüyü kontrol et
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                adjustHeroHeight();
                
                // Menü durumunu kontrol et
                const navLinks = document.querySelector('.nav-links');
                if (navLinks && navLinks.classList.contains('active')) {
                    // Gerekirse overlay opacity'sini güncelle
                    const overlay = document.querySelector('.nav-overlay');
                    if (overlay) {
                        overlay.style.opacity = '1';
                        overlay.style.visibility = 'visible';
                    }
                }
            }, 100);
        });
        
        console.log('✅ Mobile fixes loaded successfully');
    }

    // DOM hazır olduğunda başlat
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
