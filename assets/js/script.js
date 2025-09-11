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
            autoplayInterval = setInterval(nextSlide, 5000); // 5 saniye
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
        'Kalite ve dürüstlük ilkesi ile 20 yıla yakın sektör deneyimini harmanlıyoruz. Kütüphanelere ürün danışmanlığı, abonelik süreç desteği ve yerinde eğitim hizmetleri sunuyoruz.': 'We blend nearly 20 years of industry experience with quality and integrity principles. We provide product consulting, subscription process support, and on-site training services to libraries.',
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
        'Gönderildi!': 'Sent!',
  // Services
        'Hizmetlerimiz': 'Our Services',
        'Ürün Danışmanlığı ve Tedarik': 'Product Consulting and Procurement',
        'Kullanıcı ve Yönetici Eğitimleri': 'User and Administrator Trainings',
        'Erişim ve Entegrasyon Desteği': 'Access and Integration Support',
        'Koleksiyon Geliştirme Danışmanlığı': 'Collection Development Consulting',
        'LibEdge olarak, 15 yılı aşkın sektör deneyimimizle eğitim ve araştırma kurumlarına özel danışmanlık ve destek hizmetleri sunuyoruz. Ürün tedarik süreçlerinin yanı sıra, ihtiyaçlarınıza yönelik çözümler geliştiriyoruz.': 
            'As LibEdge, with over 15 years of industry experience, we offer specialized consulting and support services to educational and research institutions. In addition to product procurement processes, we develop solutions tailored to your needs.',
        'Kurumunuz için en uygun eğitim ve araştırma kaynaklarını belirliyor, bütçeniz doğrultusunda en avantajlı tedarik süreçlerini yönetiyoruz.': 
            'We identify the most suitable educational and research resources for your institution and manage the most advantageous procurement processes within your budget.',
        'Tedariğini sağladığımız veya kurumunuzda bulunan kaynakların en verimli şekilde kullanılması için yerinde veya online eğitimler düzenliyoruz.': 
            'We organize on-site or online training to ensure the most efficient use of the resources we provide or those already available at your institution.',
        'Kaynakların kurumunuzun sistemlerine entegrasyonu, uzaktan erişim ayarları ve teknik sorun giderme konularında destek sağlıyoruz.': 
            'We provide support for integrating resources into your institution’s systems, setting up remote access, and resolving technical issues.',
        'Kütüphane ve bilgi merkezlerinin koleksiyonlarını güncel tutmaları ve geliştirmeleri için uzman danışmanlık hizmeti veriyoruz.': 
            'We offer expert consulting services to help libraries and information centers keep their collections up-to-date and develop them further.',
        // Partners
        'İş Ortakları': 'Partners',
        // Customer Reviews
        'Müşteri Görüşleri': 'Customer Reviews',
        '"LibEdge ile çalışmak işlerimizi çok kolaylaştırdı. Hızlı yanıtları ve çözüm odaklı yaklaşımları sayesinde ihtiyaçlarımıza en uygun kaynaklara ulaştık."': 
            '"Working with LibEdge has made our work much easier. Thanks to their quick responses and solution-oriented approach, we accessed the most suitable resources for our needs."',
        '"Sağladıkları eğitimler çok faydalı oldu. Kullanıcılarımız artık kaynakları daha etkin kullanabiliyor. LibEdge ekibine teşekkür ederiz."': 
            '"The training they provided was very beneficial. Our users can now use the resources more effectively. Thank you to the LibEdge team."',
        '"Hizmete sunduğu kaynakların yanı sıra yeni ürünlerle ilgili danışmanlık ve yenilikçi çözümler sunma anlayışında olması nedeniyle LibEdge firması ile çalışmak her zaman avantajlı."':'"Working with LibEdge is always advantageous due to their understanding of providing consulting on new products and innovative solutions alongside the resources they offer."' ,
        'Kütüphane Müdürü': 'Library Director',
        'Birim Sorumlusu': 'Unit Supervisor',
        'Üniversitesi': 'University',
        // Contact
        'Bize Ulaşın': 'Contact Us',
        'Sorularınız, iş birliği teklifleriniz veya geri bildirimleriniz için bize yazmaktan çekinmeyin. Ekibimiz en kısa sürede size geri dönecektir.': 
            'Feel free to write to us with your questions, collaboration proposals, or feedback. Our team will get back to you as soon as possible.',
        'Adınız Soyadınız': 'Your Full Name',
        'E-posta Adresiniz': 'Your Email Address',
        'Telefon Numaranız (İsteğe Bağlı)': 'Your Phone Number (Optional)',
        'Konu': 'Subject',
        'Mesajınız': 'Your Message',
        'İletişim Bilgileri': 'Contact Information',
        'Bizi Takip Edin': 'Follow Us',

        // Footer
        'Hızlı Linkler': 'Quick Links',
        'GİZLİLİK POLİTİKASI': 'PRIVACY POLICY',
        'KULLANIM ŞARTLARI': 'TERMS OF USE',
        '© 2025 LIBEDGE TÜM HAKLARI SAKLIDIR': '© 2025 LIBEDGE ALL RIGHTS RESERVED',
        'LibEdge ||| Daire: 2617, Adalet, Manas Blv. No: 47/B, 35530 Bayraklı/İzmir': 
            'LibEdge ||| Suite: 2617, Adalet, Manas Blv. No: 47/B, 35530 Bayraklı/Izmir',

        // Modals
        'Deneme Erişimi İsteği': 'Request Trial Access',
        'Ürün Öneriniz Var mı?': 'Do You Have a Product Suggestion?',
        'Deneme Erişimi Talep Formu': 'Trial Access Request Form',
        'Ürün Öneri Formu': 'Product Suggestion Form',
        'Ad Soyad': 'Full Name',
        'E-posta': 'Email',
        'Kurum Adı': 'Institution Name',
        'Talep Detayınız': 'Your Request Details',
        'Ürün Öneri Detayınız': 'Your Product Suggestion Details',

        // Product Cards
        'Pangram': 'Pangram',
        '✔ Yapay zeka içerik tespit': '✔ AI content detection',
        '✔ Segment bazlı analiz': '✔ Segment-based analysis',
        '✔ Geniş dil desteği (20+ Dil)': '✔ Wide language support (20+ languages)',
        '✔ Yüksek doğruluk': '✔ High accuracy',
        'ChatPDF': 'ChatPDF',
        '✔ PDF\'lerle etkileşimli sohbet aracı': '✔ Interactive chat tool for PDFs',
        '✔ Akademik makaleleri anlama': '✔ Understanding academic papers',
        '✔ Hızlı doküman analizi': '✔ Fast document analysis',
        'Wonders': 'Wonders',
        '✔ Yaratıcı içerik platformu': '✔ Creative content platform',
        '✔ Eğitim materyalleri': '✔ Educational materials',
        '✔ Interaktif öğrenme': '✔ Interactive learning',
        'Piri Keşif': 'Piri Discovery',
        '✔ Keşif ve araştırma platformu': '✔ Discovery and research platform',
        '✔ Veri analiz araçları': '✔ Data analysis tools',
        '✔ Bilgi keşif sistemi': '✔ Knowledge discovery system',
        'Transleyt': 'Transleyt',
        '✔ Gelişmiş çeviri aracı': '✔ Advanced translation tool',
        '✔ 100+ dil desteği': '✔ Support for 100+ languages',
        '✔ Akademik metin çevirisi': '✔ Academic text translation',
        'Primal Pictures': 'Primal Pictures',
        '✔ İlk 3D insan anatomisi atlası.': '✔ First 3D human anatomy atlas.',
        '✔ Visible Human Project verileri.': '✔ Visible Human Project data.',
        '✔ Tıp, hemşirelik, fizyoterapi modelleri.': '✔ Models for medicine, nursing, physiotherapy.',
        '✔ Animasyon, MR ve cerrahi görüntüler.': '✔ Animations, MR, and surgical images.',
        '✔ Sınırsız erişim platformu.': '✔ Unlimited access platform.',
        'Lecturio': 'Lecturio',
        '✔ Tıp eğitimi platformu': '✔ Medical education platform',
        '✔ Video dersler': '✔ Video lectures',
        '✔ USMLE hazırlık': '✔ USMLE preparation',
        'NEJMHealer': 'NEJM Healer',
        '✔ Klinik vaka tabanlı öğrenme': '✔ Clinical case-based learning',
        '✔ Gerçek hasta senaryoları': '✔ Real patient scenarios',
        '✔ Tıbbi karar verme eğitimi': '✔ Medical decision-making training',
        'AccessEngineering': 'AccessEngineering',
        '✔ Mühendislik ve fen bilimleri kaynağı': '✔ Engineering and science resource',
        '✔ Kapsamlı referans materyaller': '✔ Comprehensive reference materials',
        '✔ Interaktif araçlar': '✔ Interactive tools',
        'AccessMedical': 'AccessMedical',
        '✔ Kapsamlı tıp kaynakları': '✔ Comprehensive medical resources',
        '✔ Tanı ve tedavi rehberleri': '✔ Diagnosis and treatment guides',
        '✔ Güncel tıp bilgileri': '✔ Up-to-date medical information',
        'Klasik Müzik Koleksiyonu': 'Classical Music Collection',
        '✔ Zengin klasik müzik arşivi': '✔ Rich classical music archive',
        '✔ Dünyaca ünlü besteciler': '✔ World-renowned composers',
        '✔ Yüksek kaliteli kayıtlar': '✔ High-quality recordings',
        'Caz Koleksiyonu': 'Jazz Collection',
        '✔ Geniş caz müzik arşivi': '✔ Extensive jazz music archive',
        '✔ Efsanevi caz sanatçıları': '✔ Legendary jazz artists',
        '✔ Tarihi performans kayıtları': '✔ Historical performance recordings',
        'BioRender': 'BioRender',
        '✔ Bilimsel illüstrasyon aracı': '✔ Scientific illustration tool',
        '✔ Profesyonel diyagramlar': '✔ Professional diagrams',
        '✔ 30.000+ bilimsel ikon': '✔ 30,000+ scientific icons',
        'Wiley Dergiler': 'Wiley Journals',
        '✔ Kapsamlı akademik dergi koleksiyonu': '✔ Comprehensive academic journal collection',
        '✔ 1.600+ hakemli dergi': '✔ 1,600+ peer-reviewed journals',
        '✔ Çok disiplinli içerik': '✔ Multidisciplinary content',
        'Wiley Kitaplar': 'Wiley Books',
        '✔ Geniş kapsamlı e-kitap arşivi': '✔ Extensive e-book archive',
        '✔ 20.000+ akademik kitap': '✔ 20,000+ academic books',
        '✔ Güncel baskılar': '✔ Current editions',
        'Cochrane Library': 'Cochrane Library',
        '✔ Kanıta dayalı tıp veritabanı': '✔ Evidence-based medical database',
        '✔ Sistematik derlemeler': '✔ Systematic reviews',
        '✔ Klinik karar destek': '✔ Clinical decision support',
        'JoVE Research': 'JoVE Research',
        '✔ Multidisipliner video dergileri': '✔ Multidisciplinary video journals',
        '✔ 13 farklı disiplin': '✔ 13 different disciplines',
        '✔ Görsel öğrenme kaynağı': '✔ Visual learning resource',
        'JoVE Education': 'JoVE Education',
        '✔ Bilimsel eğitim video koleksiyonu': '✔ Scientific educational video collection',
        '✔ Laboratuvar teknikleri': '✔ Laboratory techniques',
        '✔ Temel bilimler eğitimi': '✔ Basic science education',
        '✔ İşletme ve yönetim odaklı video içeriği': '✔ Business and management-focused video content',
        '✔ Finans, Pazarlama, Mikroekonomi': '✔ Finance, Marketing, Microeconomics',
        '✔ Animasyonlu dersler': '✔ Animated lessons',
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