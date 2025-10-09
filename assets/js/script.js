document.addEventListener('DOMContentLoaded', function() {
    // --- Flip Card Interaction ---
document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', function(e) {
        // Allow clicks on links within the card without flipping
        if (e.target.tagName.toLowerCase() === 'a') {
            return;
        }
        this.querySelector('.flip-inner').classList.toggle('flipped');
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


// --- Form Handling ---
function handleFormSubmit(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault(); // Varsayılan form gönderimini engelle

        const formData = new FormData(form);
        const formDataObj = {
            // ÖNEMLİ: Bu satır form tipini belirler
            formType: formId.replace('Form', '') 
        };

        // FormData'yı JSON nesnesine çevir
        formData.forEach((value, key) => {
            formDataObj[key] = value;
        });

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Gönderiliyor...';

        try {
            const response = await fetch("https://form-handler.agursel.workers.dev/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formDataObj)
            });

            if (!response.ok) {
                throw new Error("Form gönderilemedi");
            }

            alert("Form başarıyla gönderildi ✅");
            form.reset();

            // Modal formları kapat
            if (formId === 'trialForm') closeModal();
            if (formId === 'suggestionForm') closeSuggestionModal();

        } catch (err) {
            console.error("Form hatası:", err);
            alert("Form gönderiminde hata oluştu ❌");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Gönder';
        }
    });
}

// Bu fonksiyonu tüm formlarınız için çağırın
handleFormSubmit("contactForm");
handleFormSubmit("trialForm");
handleFormSubmit("suggestionForm");



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
    
    // YENİ KONTROL: Boşluk tuşuna basıldığında
    if (e.key === ' ') {
        // Aktif olan (içinde bulunulan) elementin ne olduğunu kontrol et
        const activeElement = document.activeElement;

        // Eğer kullanıcı bir INPUT veya TEXTAREA içinde DEĞİLSE, slaytı kontrol et
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault(); // Sadece bu durumda varsayılanı engelle (örn. sayfayı aşağı kaydırma)
            toggleAutoplay();
        }
        // Eğer kullanıcı bir form elemanındaysa, bu blok çalışmaz ve boşluk normal şekilde yazılır.
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
        'Öncü Yayıncılarla İş Birliği': 'Collaboration with Leading Publishers',
        'Dünyanın önde gelen akademik yayıncıları ve teknoloji sağlayıcıları ile stratejik iş birlikleri. Kurumunuz için en güncel ve nitelikli içeriğe erişin.': 'Strategic partnerships with the world\'s leading academic publishers and technology providers. Access the most current and high-quality content for your institution.',
        'İş Ortaklarımızı Görün': 'See Our Partners',
        'Hizmetlerimizle Tanışın': 'Explore Our Services',
        'Eğitim ve Danışmanlık Çözümleri': 'Education and Consulting Solutions',
        'Kütüphane personeli ve akademisyenler için özelleştirilmiş eğitim programları ve stratejik danışmanlık hizmetleri.' : 'Customized training programs and strategic consulting services for library staff and academics.',
        'Hizmetlerimizi Keşfedin': 'Discover Our Services',
        'Teknoloji ve İnovasyon': 'Technology and Innovation',
        'Yapay zeka destekli araştırma araçlarından, interaktif öğrenme platformlarına kadar yenilikçi çözümler.' : 'From AI-powered research tools to interactive learning platforms.',
        'Yapay Zeka Ürünlerimiz': 'Our AI Products',
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
        'Türkiye': 'Türkiye',
        'Orta Doğu': 'Middle East',
        'Türkiye (EKUAL dışı)': 'Türkiye (Non-EKUAL)',
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
        'İstanbul Okan Üniversitesi': 'Istanbul Okan University',
        'Bursa Uludağ Üniversitesi': 'Bursa Uludag University',
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
        'Ürün Kategorileri': 'Product Categories',
        'Hızlı Linkler': 'Quick Links',
        'Gizlilik Politikası': 'Privacy Policy',
        'Kullanım Şartları': 'Terms of Use',
        'Çerez Politikası': 'Cookie Policy',
        '© 2025 LibEdge Eğitim ve Danışmanlık. Tüm hakları saklıdır.': '© 2025 LibEdge Education and Consulting. All rights reserved.',
        'Eğitim ve Danışmanlık': 'Education and Consulting',     
        '20 yıla yakın sektör deneyimi ile eğitim ve araştırma kurumlarına premium çözümler sunuyoruz.': 'With nearly 20 years of industry experience, we provide premium solutions to educational and research institutions.',
        'Türkiye ve Orta Doğu bölgesinde eğitim teknolojileri ve akademik kaynaklarda güvenilir iş ortağınız': 'Your trusted partner in educational technologies and academic resources in Turkey and the Middle East region',
        'Haritada Görüntüle': 'View on Map',

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
        '✔ Daha hızlı yayımlanma için kontrol süresini azalt' : '✔ Reduce review time for faster publication',
        '✔  Bilimsel makalelerin kalitesini artır' : '✔ Enhance the quality of scientific articles',
        '✔ Kurumların itibarını koru' : '✔ Protect institutional reputation',
        '✔ Yapay zeka destekli asistan çözümleri': '✔ AI-powered assistant solutions',
        '✔ Kurumlar için verimlilik ve hız': '✔ Efficiency and speed for institutions',
        '✔ Kullanıcı deneyimini geliştiren yenilikçi teknoloji': '✔ Innovative technology enhancing user experience',



        // --- YASAL METİNLERİN ÇEVİRİLERİ ---
    'Gizlilik Politikası ve Aydınlatma Metni': 'Privacy Policy and Data Processing Notice',
    'Web Sitesi Kullanım Şartları': 'Website Terms of Use',
    'Çerez Politikası': 'Cookie Policy',
    'Son Güncelleme Tarihi:': 'Last Updated:',

    // 1. Gizlilik Politikası (privacy.html)
    '1. Veri Sorumlusu Kimliği (Data Controller)': '1. Data Controller',
    'Kişisel Verilerin Korunması Kanunu (KVKK) ve Genel Veri Koruma Yönetmeliği (GDPR) uyarınca Veri Sorumlusu:': 'Data Controller under GDPR and the Turkish Personal Data Protection Law (KVKK):',
    'Unvan:': 'Title:',
    'Web Sitesi:': 'Website:',
    'İletişim E-posta:': 'Contact Email:',
    '2. Toplanan Veriler ve İşleme Amaçları': '2. Data Collected and Purposes of Processing',
    'Verileriniz, temel olarak talep toplama ve site güvenliğini sağlama amaçlarıyla işlenir:': 'Your data is processed primarily for communication and site security purposes:',
    'Veri Kategorisi': 'Data Category',
    'İşleme Amacı': 'Processing Purpose',
    'Hukuki Sebep (KVKK/GDPR)': 'Legal Basis (GDPR/KVKK)',
    'Kimlik ve İletişim': 'Identity & Contact',
    '(Ad, E-posta, Tel No - Formlardan)': '(Name, Email, Phone No - From Forms)',
    'Bilgilendirme taleplerinizi yanıtlamak ve sizinle iletişim kurmak.': 'Responding to your information requests and communicating with you.',
    'Açık Rıza / Sözleşme Öncesi Görüşmeler': 'Consent / Pre-contractual measures',
    'İşlem Güvenliği': 'Transaction Security',
    '(IP Adresi, Log Kayıtları)': '(IP Address, Log Records)',
    'Siber güvenliği sağlamak, yasal yükümlülükleri yerine getirmek.': 'Ensuring cybersecurity and complying with legal obligations.',
    'Meşru Menfaat / Yasal Yükümlülük': 'Legitimate Interest / Legal Obligation',
    'Pazarlama/Analiz': 'Marketing/Analytics',
    '(Çerez Verileri)': '(Cookie Data)',
    'Site performansını ölçmek ve iyileştirmek.': 'Measuring and improving site performance.',
    'Açık Rıza (Çerez Politikasına Bakınız)': 'Consent (Refer to the Cookie Policy)',
    '3. Veri Aktarımı': '3. Data Transfers',
    'Verileriniz, web sitesinin barındırma ve dağıtım hizmetleri (GitHub, Cloudflare) yurt dışında bulunduğu için ve analitik hizmetler (kullanılıyorsa) nedeniyle yurt dışına aktarılmaktadır. Bu aktarım, veri güvenliğini sağlamak amacıyla gerekli tedbirler alınarak gerçekleştirilmektedir.': 'Your data is transferred internationally due to the location of the hosting and distribution services (GitHub, Cloudflare) and any analytical services (if used) used by the website. This transfer is carried out by taking the necessary measures to ensure data security.',
    '4. Veri Sahibi Hakları': '4. Data Subject Rights',
    'KVKK Madde 11 ve GDPR kapsamında, kişisel verilerinizin işlenip işlenmediğini öğrenme, silinmesini veya düzeltilmesini talep etme hakkına sahipsiniz. Başvurularınızı yukarıdaki e-posta adresine yazılı olarak iletebilirsiniz.': 'Under GDPR and KVKK Article 11, you have the right to know if your data is processed, and to request its deletion or correction. You may send your requests in writing to the email address provided above.',
    '5. Gelecek Planları': '5. Future Plans',
    'İleride kayıtlı kullanıcı sistemi veya ödeme işlemleri eklendiğinde, bu politika yeni veri kategorileri ve işleme amaçlarını kapsayacak şekilde güncellenecektir.': 'This policy will be updated when a registered user system or payment processes are introduced in the future, to cover new data categories and processing purposes.',

    // 2. Kullanım Şartları (terms.html)
    '1. Taraflar ve Kabul': '1. Parties and Acceptance',
    'Bu Kullanım Şartları ("Şartlar"), LibEdge Eğitim ve Danışmanlık ("LibEdge") ile web sitesini ziyaret eden veya kullanan kişi ("Kullanıcı") arasındaki ilişkiyi düzenler. Web sitesine erişim sağlayarak, bu Şartları kabul etmiş sayılırsınız.': 'These Terms of Use ("Terms") govern the relationship between LibEdge Education and Consulting ("LibEdge") and the person visiting or using the website ("User"). By accessing the website, you agree to these Terms.',
    '2. Hizmetlerin Kapsamı ve Fikri Mülkiyet': '2. Scope of Services and Intellectual Property',
    'LibEdge, web sitesi aracılığıyla eğitim ve danışmanlık hizmetlerine ilişkin tanıtım ve bilgilendirme materyalleri sunar.': 'LibEdge provides promotional and informational materials regarding education and consulting services through the website.',
    'Web sitesinde yer alan tüm içerik (metinler, tasarımlar, logolar vb.) LibEdge\'e aittir ve telif hakkı yasaları ile korunmaktadır. İçerikler, LibEdge\'in yazılı izni olmaksızın çoğaltılamaz veya ticari amaçla kullanılamaz.': 'All content on the website (texts, designs, logos, etc.) belongs to LibEdge and is protected by copyright laws. Content may not be reproduced or used for commercial purposes without the written permission of LibEdge.',
    '3. Kullanıcı Yükümlülükleri': '3. User Obligations',
    'Kullanıcı, siteyi yasalara, ahlaka ve bu Şartlara uygun kullanmayı kabul eder.': 'The User agrees to use the site in compliance with laws, ethics, and these Terms.',
    'İletişim formları aracılığıyla sağlanan bilgilerin doğru, eksiksiz ve güncel olduğu beyan edilir.': 'It is declared that the information provided through the communication forms is accurate, complete, and up-to-date.',
    'Siteye veya diğer kullanıcılara zarar verecek (virüs, DDOS saldırısı vb.) her türlü eylem yasaktır.': 'Any action that may harm the site or other users (virus, DDOS attack, etc.) is prohibited.',
    '4. Sorumluluk Reddi': '4. Disclaimer',
    'Web sitesi ve içerikleri "olduğu gibi" esasına göre sunulmaktadır. LibEdge, sitenin kesintisiz, hatasız veya güvenli olacağına dair herhangi bir garanti vermez. İçerikteki bilgilerin doğruluğu konusunda sorumluluk kabul edilmez.': 'The website and its content are provided on an "as is" basis. LibEdge makes no guarantee that the site will be uninterrupted, error-free, or secure. No responsibility is accepted for the accuracy of the information contained in the content.',
    '5. Uygulanacak Hukuk ve Yetkili Mahkeme': '5. Governing Law and Jurisdiction',
    'Bu Şartların yorumlanmasında ve uygulanmasında Türk Hukuku esas alınacaktır. Doğabilecek her türlü uyuşmazlığın çözümünde İzmir Mahkemeleri ve İcra Daireleri yetkilidir.': 'Turkish Law will govern the interpretation and application of these Terms. The Courts and Enforcement Offices of İzmir are authorized to resolve any disputes that may arise.',

    // 3. Çerez Politikası (cookies.html)
    '1. Çerez Nedir?': '1. What are Cookies?',
    'Çerezler ("Cookie"), bir web sitesini ziyaret ettiğinizde cihazınızda (bilgisayar, telefon vb.) depolanan küçük metin dosyalarıdır. Çerezler, web sitesinin sizi hatırlamasını ve sonraki ziyaretlerinizde daha iyi bir deneyim sunmasını sağlar.': 'Cookies are small text files stored on your device (computer, phone, etc.) when you visit a website. Cookies allow the website to remember you and provide a better experience on your subsequent visits.',
    '2. Çerez Kullanım Amaçları ve Türleri': '2. Purposes and Types of Cookie Usage',
    'LibEdge olarak web sitemizde KVKK ve GDPR hükümlerine uygun olarak aşağıdaki amaçlarla çerezler kullanmaktayız:': 'As LibEdge, we use cookies on our website for the following purposes in accordance with KVKK and GDPR provisions:',
    'Zorunlu Çerezler:': 'Strictly Necessary Cookies:',
    'Web sitesinin temel işlevlerini yerine getirmesi için kesinlikle gereklidir (Oturum yönetimi, site güvenliği). Bu çerezler için yasal olarak Açık Rıza gerekmez.': 'Absolutely necessary for the website to perform its basic functions (Session management, site security). Explicit Consent is not legally required for these cookies.',
    'Analitik/Performans Çerezleri:': 'Analytical/Performance Cookies:',
    'Web sitesi trafiğini ölçmek, hangi sayfaların ziyaret edildiğini analiz etmek ve site performansını iyileştirmek için kullanılır (Örn: Google Analytics). Bu çerezler için Açık Rıza gereklidir.': 'Used to measure website traffic, analyze which pages are visited, and improve site performance (e.g., Google Analytics). Explicit Consent is required for these cookies.',
    'İşlevsellik Çerezleri:': 'Functionality Cookies:',
    'Dil tercihi, font boyutu gibi kullanıcı ayarlarını hatırlayarak size kişiselleştirilmiş bir deneyim sunmak için kullanılır. Bu çerezler için Açık Rıza gereklidir.': 'Used to remember user settings such as language preference and font size to offer you a personalized experience. Explicit Consent is required for these cookies.',
    '3. Açık Rıza ve Yönetim': '3. Explicit Consent and Management',
    'Zorunlu olmayan tüm çerezler, sitenin ilk ziyaretinde karşınıza çıkan Çerez Onay Bannerı (CMP) aracılığıyla alınan Açık Rızanız ile işlenir. Bu rızayı dilediğiniz zaman aynı mekanizma üzerinden geri çekebilirsiniz.': 'All non-essential cookies are processed with your Explicit Consent, obtained through the Cookie Consent Banner (CMP) that appears upon your first visit. You can withdraw this consent at any time via the same mechanism.',
    'Çerez tercihlerinizi tarayıcı ayarlarınız üzerinden de (silme veya engelleme) yönetebilirsiniz.': 'You can also manage your cookie preferences through your browser settings (deleting or blocking).',
    '4. Üçüncü Taraf Çerezler': '4. Third-Party Cookies',
    'Web sitemiz, barındırma hizmeti (GitHub, Cloudflare) veya analitik hizmetler (Google) gibi üçüncü taraflarca yerleştirilen çerezleri kullanabilir. Bu çerezlerin yönetiminden ilgili üçüncü taraf sorumludur.': 'Our website may use cookies placed by third parties such as hosting services (GitHub, Cloudflare) or analytical services (Google). The relevant third party is responsible for the management of these cookies.',
        // Add more translations as needed
    };

    // Function to translate text content and attributes
function translatePage(toEnglish) {
    // Add translating class to indicate loading state
    document.body.classList.add('translating');
    if (translateButton) translateButton.disabled = true;

    // Tüm çevrilebilir öğeleri seç
    const translatableElements = document.querySelectorAll('[translatable], .translatable');
    
    translatableElements.forEach(element => {
        // Metin içeriğini çevir
        if (element.textContent.trim()) {
            const originalText = element.textContent.trim();
            
            if (toEnglish && translations[originalText]) {
                // Orijinal metni sakla ve çeviriyi uygula
                element.dataset.originalText = originalText;
                element.textContent = translations[originalText];
            } else if (!toEnglish && element.dataset.originalText) {
                // Orijinal metne geri dön
                element.textContent = element.dataset.originalText;
                delete element.dataset.originalText;
            }
        }
        
        // Placeholder'ları çevir
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
        
        // Diğer öznitelikleri çevir (title, aria-label, vb.)
        ['title', 'aria-label', 'alt'].forEach(attr => {
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

    // Buton metnini güncelle
    if (translateButton) {
        const translateText = document.getElementById('translateText');
        if (translateText) {
            translateText.textContent = toEnglish ? 'Türkçe' : 'English';
        } else {
            // Fallback: doğrudan butonun içeriğini güncelle
            translateButton.textContent = toEnglish ? 'Türkçe' : 'English';
        }
    }

    // Dil tercihini sakla
    localStorage.setItem('language', toEnglish ? 'en' : 'tr');

    // Çeviri tamamlandığında translating sınıfını kaldır
    setTimeout(() => {
        document.body.classList.remove('translating');
        if (translateButton) translateButton.disabled = false;
    }, 300);
}

    // Apply translations on page load based on saved preference
// Apply translations on page load based on saved preference
if (isTranslated && translateButton) {
    translatePage(true);
    // Buton metnini güncelle
    const translateText = document.getElementById('translateText');
    if (translateText) {
        translateText.textContent = 'Türkçe';
    }
} else if (translateButton) {
    // Türkçe modunda buton metnini ayarla
    const translateText = document.getElementById('translateText');
    if (translateText) {
        translateText.textContent = 'English';
    }
}

    // Toggle translation on button click
    if (translateButton) {
        translateButton.addEventListener('click', () => {
            isTranslated = !isTranslated;
            translatePage(isTranslated);
        });
    }

    // Hero slider'daki "Yapay Zeka Ürünlerimiz" butonu için
setTimeout(() => {
    // Tüm hero-badge linklerini kontrol et
    document.querySelectorAll('a.hero-badge[href="#products"]').forEach(link => {
        if (link.textContent.includes('Yapay Zeka') || link.querySelector('i.fa-robot')) {
            // Mevcut href'i kaldır ve yeni fonksiyon ekle
            link.removeAttribute('href');
            link.style.cursor = 'pointer';
            
            link.onclick = function(e) {
                e.preventDefault();
                
                // Products'a scroll yap
                document.getElementById('products').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
                
                // Filtreyi uygula
                setTimeout(() => {
                    // Yapay zeka butonunu bul ve tıkla
                    const aiFilterBtn = document.querySelector('.subject-btn[data-subject="yapay-zeka"]');
                    if (aiFilterBtn) {
                        aiFilterBtn.click(); // Bu, mevcut filtre sistemini kullanır
                    }
                }, 800);
            };
        }
    });
}, 1000);

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