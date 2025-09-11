document.addEventListener('DOMContentLoaded', function() {
    // --- Flip Card Interaction ---
    document.querySelectorAll('.flip-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Only apply click-flip on smaller screens (mobile/tablet view)
            if (window.innerWidth <= 1280) {
                const flipInner = card.querySelector('.flip-inner');
                const isGlobalFlipActive = document.querySelector('.flip-all-cards');

                if (isGlobalFlipActive) {
                    // If global flip is on, individual clicks toggle their state
                    flipInner.classList.toggle('flipped');
                    flipInner.style.transform = flipInner.classList.contains('flipped') ?
                        'rotateY(180deg)' :
                        'none';
                } else {
                    // Normal mobile behavior: flip unless clicking a link
                    if (!e.target.closest('a')) {
                        flipInner.classList.toggle('flipped');
                    }
                }
            }
        });
    });

    // Reset cards on window resize to avoid inconsistent states
    window.addEventListener('resize', () => {
        document.querySelectorAll('.flip-inner').forEach(flipInner => {
            flipInner.classList.remove('flipped');
            flipInner.style.transform = ''; // Reset inline style if any
        });
        // Also reset global flip if active
        const productsGrid = document.getElementById('products-grid');
        if (productsGrid) {
           productsGrid.classList.remove('flip-all-cards');
        }
    });

    // --- Product Filtering ---
    const subjectButtons = document.querySelectorAll('.subject-btn');
    const productsGrid = document.getElementById('products-grid');

    if (productsGrid && subjectButtons.length > 0) {
        const productCards = Array.from(productsGrid.querySelectorAll('.product-card-container'));
        const originalOrder = [...productCards]; // Store initial order
        let activeSubcatOrder = []; // Track filter order

        subjectButtons.forEach(button => {
            button.addEventListener('click', function() {
                const subject = this.dataset.subject;

                if (subject === 'all') {
                    // "All" button selected: deactivate others, activate "All"
                    subjectButtons.forEach(btn => {
                        btn.classList.remove('active');
                        btn.setAttribute('aria-pressed', 'false');
                    });
                    this.classList.add('active');
                    this.setAttribute('aria-pressed', 'true');
                    activeSubcatOrder = []; // Reset subcategory order
                } else {
                    // Specific category button selected
                    document.querySelector('.subject-btn[data-subject="all"]').classList.remove('active');
                    document.querySelector('.subject-btn[data-subject="all"]').setAttribute('aria-pressed', 'false');
                    this.classList.toggle('active');
                    this.setAttribute('aria-pressed', this.classList.contains('active') ? 'true' : 'false');

                    // Update subcategory order (most recent at the start)
                    activeSubcatOrder = activeSubcatOrder.filter(s => s !== subject);
                    if (this.classList.contains('active')) {
                        activeSubcatOrder.unshift(subject);
                    }

                    // If no specific category is active, activate "All"
                    if (document.querySelectorAll('.subject-btn.active').length === 0) {
                        document.querySelector('.subject-btn[data-subject="all"]').classList.add('active');
                        document.querySelector('.subject-btn[data-subject="all"]').setAttribute('aria-pressed', 'true');
                    }
                }
                updateFilter(); // Apply the filter
            });
        });

        // Make updateFilter globally accessible
        window.updateFilter = function() {
            const activeButtons = Array.from(document.querySelectorAll('.subject-btn.active'));
            const activeSubjects = activeButtons.map(btn => btn.dataset.subject).filter(subcat => subcat !== 'all');
            const isAllActive = activeButtons.some(btn => btn.dataset.subject === 'all');

            productsGrid.innerHTML = ''; // Clear current grid

            let cardsToDisplay = [];

            if (isAllActive || activeSubjects.length === 0) {
                // Show all cards in original order
                cardsToDisplay = [...originalOrder];
            } else {
                // Filter cards based on active subjects
                cardsToDisplay = productCards.filter(card => {
                    const cardSubjects = card.dataset.subjects.split(',');
                    return activeSubjects.some(s => cardSubjects.includes(s));
                });

                // Sort based on the order they were clicked
                cardsToDisplay.sort((a, b) => {
                    const aSubjects = a.dataset.subjects.split(',');
                    const bSubjects = b.dataset.subjects.split(',');
                    let aPriority = -1;
                    let bPriority = -1;

                    for (let i = 0; i < activeSubcatOrder.length; i++) {
                        const sub = activeSubcatOrder[i];
                        if (aSubjects.includes(sub) && aPriority === -1) aPriority = activeSubcatOrder.length - 1 - i;
                        if (bSubjects.includes(sub) && bPriority === -1) bPriority = activeSubcatOrder.length - 1 - i;
                    }
                    return bPriority - aPriority;
                });
            }

            // Display cards or a "no results" message
            if (cardsToDisplay.length > 0) {
                cardsToDisplay.forEach(card => {
                    card.style.display = 'block';
                    productsGrid.appendChild(card);
                });
            } else {
                const noResultsMessage = document.createElement('div');
                noResultsMessage.id = 'no-results-message';
                noResultsMessage.className = 'no-results-message';
                noResultsMessage.textContent = 'Seçtiğiniz kriterlere uygun ürün bulunamadı.';
                productsGrid.appendChild(noResultsMessage);
            }
        };

        updateFilter(); // Initial filter application
    }

    // --- Back to Top Button ---
    const backToTopButton = document.getElementById('backToTop');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('visible');
            } else {
                backToTopButton.classList.remove('visible');
            }
        });

        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- "Brochures" Link Flips All Cards ---
    const brochuresLink = document.querySelector('a[href="#brochures"]');
    if (brochuresLink && productsGrid) {
        brochuresLink.addEventListener('click', function(e) {
            e.preventDefault();
            productsGrid.classList.add('flip-all-cards');

            const productsSection = document.getElementById('products');
            if (productsSection) {
                window.scrollTo({
                    top: productsSection.offsetTop - 80, // Adjust offset for nav height
                    behavior: 'smooth'
                });
            }
        });
    }

    // --- Click Outside / Filter Click Removes Global Flip ---
    document.addEventListener('click', function(e) {
        if (productsGrid && !e.target.closest('.flip-card') &&
            !e.target.closest('a[href="#brochures"]') &&
            !e.target.closest('.subject-btn')) {
            productsGrid.classList.remove('flip-all-cards');
        }
    });

    subjectButtons.forEach(button => {
        button.addEventListener('click', function() {
            if(productsGrid) productsGrid.classList.remove('flip-all-cards');
        });
    });

    // Update the mobile menu toggle to be more touch-friendly
    document.querySelectorAll('.nav-links .group > a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (window.innerWidth <= 639) {
                e.preventDefault();
                this.parentElement.classList.toggle('active');
            }
        });
    });

    // --- Navigation Dropdown Links (Scroll & Flip) ---
    document.querySelectorAll('.nav-links .dropdown a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetCard = document.getElementById(targetId);

            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                const flipInner = targetCard.querySelector('.flip-inner');
                if (flipInner && !flipInner.classList.contains('flipped')) {
                    flipInner.classList.add('flipped');
                    // Optionally, flip back after a delay
                    setTimeout(() => flipInner.classList.remove('flipped'), 3000);
                }
            }
        });
    });

    // --- Form Handling ---
    const trialForm = document.getElementById('trialForm');
    const suggestionForm = document.getElementById('suggestionForm');

    if (trialForm) {
        trialForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
            
            // Simulate form submission
            setTimeout(() => {
                submitBtn.innerHTML = 'Gönderildi!';
                setTimeout(() => {
                    closeModal();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Gönder';
                }, 1500);
            }, 1000);
        });
    }

    if (suggestionForm) {
        suggestionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';
            
            // Simulate form submission
            setTimeout(() => {
                submitBtn.innerHTML = 'Gönderildi!';
                setTimeout(() => {
                    closeSuggestionModal();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Gönder';
                }, 1500);
            }, 1000);
        });
    }

    // --- Mobile Hamburger Menu ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const dropdownGroups = document.querySelectorAll('.nav-links .group');

    if (navLinks) {
        navLinks.classList.remove('active'); // Ensure closed on load
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent immediate closing
            navLinks.classList.toggle('active');
            const isActive = navLinks.classList.contains('active');
            this.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isActive ? 'fas fa-times' : 'fas fa-bars';
            }
            if (!isActive) {
                // Close all dropdowns when closing menu
                dropdownGroups.forEach(group => group.classList.remove('active'));
            }
        });
    }

    // Mobile Dropdown Toggles
    dropdownGroups.forEach(group => {
        const dropdownLink = group.querySelector('a');
        if (dropdownLink) {
            dropdownLink.addEventListener('click', function(e) {
                if (window.innerWidth <= 639 && group.querySelector('.dropdown')) {
                    e.preventDefault(); // Prevent nav link if it has dropdown
                    e.stopPropagation();
                    const wasActive = group.classList.contains('active');
                    // Close others before opening this one
                    dropdownGroups.forEach(other => other.classList.remove('active'));
                    // Toggle current one (re-add if it wasn't the one active)
                    if (!wasActive) {
                        group.classList.add('active');
                    }
                }
            });
        }
    });

    // Close Mobile Menu on Outside Click
    document.addEventListener('click', function(e) {
        if (navLinks && navLinks.classList.contains('active') &&
            !e.target.closest('.hamburger') && !e.target.closest('.nav-links')) {
            navLinks.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('i').className = 'fas fa-bars';
            }
            dropdownGroups.forEach(group => group.classList.remove('active'));
        }
    });

    // Close Mobile Menu on Resize to Desktop
    window.addEventListener('resize', () => {
        if (window.innerWidth > 639 && navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            if (hamburger) {
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.querySelector('i').className = 'fas fa-bars';
            }
            dropdownGroups.forEach(group => group.classList.remove('active'));
        }
    });

    // --- Hero Slider ---
    const slider = document.getElementById('hero-slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const autoplayToggle = document.getElementById('autoplayToggle');
    const slides = document.querySelectorAll('.hero-slide');
    const dotsContainer = document.querySelector('.slider-dots-container');
    
    if (slider && slides.length > 0) {
        const totalSlides = slides.length;
        let currentSlide = 0;
        let autoplayInterval;
        let isAutoplayActive = true;
        
        // Slider dots oluştur
        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.classList.add('slider-dot');
            dot.setAttribute('aria-label', `Slide ${index + 1} göster`);
            dot.addEventListener('click', () => showSlide(index));
            dotsContainer.appendChild(dot);
        });
        
        const dots = document.querySelectorAll('.slider-dot');
        
        function showSlide(index) {
            // Slide sınır kontrolleri
            if (index >= totalSlides) {
                currentSlide = 0;
            } else if (index < 0) {
                currentSlide = totalSlides - 1;
            } else {
                currentSlide = index;
            }
            
            // Slide'ı hareket ettir
            const offset = -currentSlide * 100;
            slider.style.transform = `translateX(${offset}%)`;
            
            // Aktif dot'u güncelle
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentSlide);
            });
            
            // Otomatik geçişi resetle
            resetAutoplay();
        }
        
        function nextSlide() {
            showSlide(currentSlide + 1);
        }
        
        function prevSlide() {
            showSlide(currentSlide - 1);
        }
        
        function startAutoplay() {
            if (isAutoplayActive) {
                autoplayInterval = setInterval(nextSlide, 10000); // 10 saniye
                if (autoplayToggle) {
                    autoplayToggle.innerHTML = '<i class="fas fa-pause"></i>';
                    autoplayToggle.setAttribute('aria-label', 'Slayt otomatik oynatmayı duraklat');
                }
            }
        }
        
        function stopAutoplay() {
            clearInterval(autoplayInterval);
            if (autoplayToggle) {
                autoplayToggle.innerHTML = '<i class="fas fa-play"></i>';
                autoplayToggle.setAttribute('aria-label', 'Slayt otomatik oynatmayı başlat');
            }
        }
        
        function resetAutoplay() {
            if (isAutoplayActive) {
                clearInterval(autoplayInterval);
                startAutoplay();
            }
        }
        
        function toggleAutoplay() {
            isAutoplayActive = !isAutoplayActive;
            if (isAutoplayActive) {
                startAutoplay();
            } else {
                stopAutoplay();
            }
        }
        
        // Event listeners
        if (prevBtn) prevBtn.addEventListener('click', prevSlide);
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);
        if (autoplayToggle) autoplayToggle.addEventListener('click', toggleAutoplay);
        
        // Klavye navigasyonu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === ' ') {
                e.preventDefault();
                toggleAutoplay();
            }
        });
        
        // Touch events for mobile swipe
        let touchStartX = 0;
        let touchEndX = 0;
        
        slider.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        slider.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
        
        function handleSwipe() {
            const swipeThreshold = 50;
            if (touchEndX < touchStartX - swipeThreshold) {
                nextSlide(); // Sola kaydırma → sonraki slide
            }
            if (touchEndX > touchStartX + swipeThreshold) {
                prevSlide(); // Sağa kaydırma → önceki slide
            }
        }
        
        // İlk dot'u aktif yap ve autoplay'ı başlat
        if (dots.length > 0) dots[0].classList.add('active');
        startAutoplay();
        
        // Sayfa görünürlüğü değiştiğinde autoplay'ı kontrol et
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoplay();
            } else if (isAutoplayActive) {
                startAutoplay();
            }
        });
    }

    // --- Translation System ---
    const translateButton = document.getElementById('translateBtn');
    let isTranslated = localStorage.getItem('language') === 'en';

    // Comprehensive translation mapping
    const translations = {
        // Header and Navigation
        'LibEdge Eğitim ve Danışmanlık': 'LibEdge Education and Consulting',
        'Edge Eğitim ve Danışmanlık': 'Edge Education and Consulting',
        'Bilginin Gücünü Keşfedin': 'Discover the Power of Knowledge',
        'Kalite ve dürüstlük ilkesi ile 20 yıla yakın sektör deneyimini harmanlanıyoruz. Kütüphanelere ürün danışmanlığı, abonelik süreç desteği ve yerinde eğitim hizmetleri sunuyoruz.': 'We blend nearly 20 years of industry experience with quality and integrity principles. We provide product consulting, subscription process support, and on-site training services to libraries.',
        'Ürünler': 'Products',
        'Broşürler': 'Brochures',
        'İletişim': 'Contact',
        'Duyurular': 'Announcements',
        'Tümü': 'All',
        'Fen & Matematik': 'Science & Mathematics',
        'Mühendislik': 'Engineering',
        'Sağlık': 'Health',
        'Sosyal Bilimler': 'Social Sciences',
        'İş & Hukuk': 'Business & Law',
        'Sanat': 'Arts',
        'Yapay Zeka': 'Artificial Intelligence',
        'Yetkili Bölge:': 'Authorized Region:',
        'Türkiye': 'Turkey',
        'Orta Doğu': 'Middle East',
        'Türkiye (EKUAL dışı)': 'Turkey (Non-EKUAL)',
        'Broşür': 'Brochure',
        'Erişim Linki': 'Access Link',
        'Deneme Erişimi İsteği': 'Request Trial Access',
        'Ürün Öneriniz Var mı?': 'Do You Have a Product Suggestion?',
        'Seçtiğiniz kriterlere uygun ürün bulunamadı.': 'No products found matching your criteria.',
        'Gönder': 'Send',
        'Gönderiliyor...': 'Sending...',
        'Gönderildi!': 'Sent!'
        // Add more translations as needed
    };

    // Function to translate text content and attributes
    function translatePage(toEnglish) {
        // Add translating class to indicate loading state
        document.body.classList.add('translating');
        if (translateButton) translateButton.disabled = true;

        // Select all elements that might contain text or translatable attributes
        const elements = document.querySelectorAll(
            '*:not(script):not(style):not(iframe):not(svg):not(path):not(rect):not(circle):not(g)'
        );

        elements.forEach(element => {
            // Translate text content
            if (element.textContent.trim() && !element.children.length) {
                const originalText = element.textContent.trim();
                if (toEnglish && translations[originalText]) {
                    element.dataset.originalText = originalText;
                    element.textContent = translations[originalText];
                } else if (!toEnglish && element.dataset.originalText) {
                    element.textContent = element.dataset.originalText;
                    delete element.dataset.originalText;
                }
            }

            // Translate placeholders
            if (element.placeholder) {
                const originalPlaceholder = element.placeholder.trim();
                if (toEnglish && translations[originalPlaceholder]) {
                    element.dataset.originalPlaceholder = originalPlaceholder;
                    element.placeholder = translations[originalPlaceholder];
                } else if (!toEnglish && element.dataset.originalPlaceholder) {
                    element.placeholder = element.dataset.originalPlaceholder;
                    delete element.dataset.originalPlaceholder;
                }
            }

            // Translate other attributes (e.g., title, aria-label)
            ['title', 'aria-label'].forEach(attr => {
                if (element.getAttribute(attr)) {
                    const originalAttr = element.getAttribute(attr).trim();
                    if (toEnglish && translations[originalAttr]) {
                        element.dataset[`original${attr.charAt(0).toUpperCase() + attr.slice(1)}`] = originalAttr;
                        element.setAttribute(attr, translations[originalAttr]);
                    } else if (!toEnglish && element.dataset[`original${attr.charAt(0).toUpperCase() + attr.slice(1)}`]) {
                        element.setAttribute(attr, element.dataset[`original${attr.charAt(0).toUpperCase() + attr.slice(1)}`]);
                        delete element.dataset[`original${attr.charAt(0).toUpperCase() + attr.slice(1)}`];
                    }
                }
            });
        });

        // Update button text
        if (translateButton) {
            translateButton.textContent = toEnglish ? 'Türkçe' : 'English';
        }

        // Persist language preference
        localStorage.setItem('language', toEnglish ? 'en' : 'tr');

        // Remove translating class after a short delay
        setTimeout(() => {
            document.body.classList.remove('translating');
            if (translateButton) translateButton.disabled = false;
        }, 300);
    }

    // Apply translations on page load based on saved preference
    if (isTranslated && translateButton) {
        translatePage(true);
    }

    // Toggle translation on button click
    if (translateButton) {
        translateButton.addEventListener('click', () => {
            isTranslated = !isTranslated;
            translatePage(isTranslated);
        });
    }

}); // End of DOMContentLoaded

// --- Global Functions ---
function openModal() {
    const modal = document.getElementById('trialModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }
}

function closeModal() {
    const modal = document.getElementById('trialModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
}

function openSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }
}

function closeSuggestionModal() {
    const modal = document.getElementById('suggestionModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
}

function toggleDropdown(button) {
    const list = button.nextElementSibling;
    if (list) {
        list.classList.toggle('hidden');
        const icon = button.querySelector('i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    }
}

function toggleProductsMenu() {
    const menu = document.getElementById('mobile-products');
    if (menu) {
        menu.classList.toggle('hidden');
        
        const icon = document.querySelector('#products-menu-toggle i');
        if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        }
    }
}

function openMapModal() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }
}

function closeMapModal() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
}