// ====================== SECURITY HELPERS ======================
// XSS koruması için ortak escape yardımcıları
window.escapeHtml = function(text) {
    if (typeof text !== 'string') text = String(text || '');
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
};

// String prototype'a da ekleyelim (opsiyonel, daha kolay kullanım için)
if (!String.prototype.escapeHtml) {
    String.prototype.escapeHtml = function() {
        return window.escapeHtml(this);
    };
}


// ====================== PAGE INITIALIZATION ======================
// Sayfa davranışlarının ana başlangıç noktası
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded - initializing site");
    
    // Auth kontrolü (async)
    checkAuth();
    
    // ✅ YENİ: Butonları başlangıçta disable et
    document.querySelectorAll('.requires-auth').forEach(btn => {
        btn.disabled = true;
    });
    
    // ✅ YENİ: Auth tamamlandığında butonları aktif et
    waitForAuth().then(user => {
        document.querySelectorAll('.requires-auth').forEach(btn => {
            btn.disabled = false;
        });
    });

    // --- Auth Forms ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            await login(email, password);
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('regFullName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            const institution = document.getElementById('regInstitution').value;
            await register(fullName, email, password, institution);
        });
    }
    
    // --- Product Cards ---
    document.querySelectorAll('.flip-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.tagName.toLowerCase() === 'a') return;
            this.querySelector('.flip-inner').classList.toggle('flipped');
        });
    });

    window.addEventListener('resize', () => {
        document.querySelectorAll('.flip-inner').forEach(flipInner => {
            flipInner.classList.remove('flipped');
            flipInner.style.transform = '';
        });
        const productsGrid = document.getElementById('products-grid');
        if (productsGrid) productsGrid.classList.remove('flip-all-cards');
    });

    // --- Product Filtering ---
    const subjectButtons = document.querySelectorAll('.subject-btn');
    const productsGrid = document.getElementById('products-grid');

    if (productsGrid && subjectButtons.length > 0) {
        const productCards = Array.from(productsGrid.querySelectorAll('.product-card-container'));
        const originalOrder = [...productCards];
        let activeSubcatOrder = [];

        subjectButtons.forEach(button => {
            button.addEventListener('click', function() {
                const subject = this.dataset.subject;

                if (subject === 'all') {
                    subjectButtons.forEach(btn => {
                        btn.classList.remove('active');
                        btn.setAttribute('aria-pressed', 'false');
                    });
                    this.classList.add('active');
                    this.setAttribute('aria-pressed', 'true');
                    activeSubcatOrder = [];
                } else {
                    document.querySelector('.subject-btn[data-subject="all"]')?.classList.remove('active');
                    document.querySelector('.subject-btn[data-subject="all"]')?.setAttribute('aria-pressed', 'false');
                    this.classList.toggle('active');
                    this.setAttribute('aria-pressed', this.classList.contains('active') ? 'true' : 'false');

                    activeSubcatOrder = activeSubcatOrder.filter(s => s !== subject);
                    if (this.classList.contains('active')) activeSubcatOrder.unshift(subject);

                    if (document.querySelectorAll('.subject-btn.active').length === 0) {
                        document.querySelector('.subject-btn[data-subject="all"]')?.classList.add('active');
                        document.querySelector('.subject-btn[data-subject="all"]')?.setAttribute('aria-pressed', 'true');
                    }
                }
                updateFilter();
            });
        });

        window.updateFilter = function() {
            const activeButtons = Array.from(document.querySelectorAll('.subject-btn.active'));
            const activeSubjects = activeButtons.map(btn => btn.dataset.subject).filter(subcat => subcat !== 'all');
            const isAllActive = activeButtons.some(btn => btn.dataset.subject === 'all');

            productsGrid.innerHTML = '';

            let cardsToDisplay = [];

            if (isAllActive || activeSubjects.length === 0) {
                cardsToDisplay = [...originalOrder];
            } else {
                cardsToDisplay = productCards.filter(card => {
                    const cardSubjects = card.dataset.subjects.split(',');
                    return activeSubjects.some(s => cardSubjects.includes(s));
                });

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

        updateFilter();
    }

    // --- Page Utilities ---
    const backToTopButton = document.getElementById('backToTop');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            backToTopButton.classList.toggle('visible', window.pageYOffset > 300);
        });
        backToTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // --- Brochure Navigation Helpers ---
    let _flipIgnoreNextOutside = false;

    function bindBrochuresFlip() {
        const pg = document.getElementById('products-grid');
        if (!pg) return;
        // Sadece nav / footer'daki Broşürler linkleri — kart arkasındaki "Broşür" butonları hariç
        document.querySelectorAll('a[href="#brochures"], a[href*="brochures"]').forEach(link => {
            if (link._brochuresFlipBound) return;
            if (link.closest('.flip-back')) return; // kart arkasındaki butonları atla
            link._brochuresFlipBound = true;
            link.addEventListener('click', function(e) {
                e.preventDefault();
                _flipIgnoreNextOutside = true; // click-outside'ın bu tıklamayı iptal etmesini engelle
                pg.classList.add('flip-all-cards');
                const productsSection = document.getElementById('products');
                if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => pg.classList.remove('flip-all-cards'), 4000);
            });
        });
    }
    bindBrochuresFlip();
    document.addEventListener('header:ready', bindBrochuresFlip);

    // --- Product Card Reset Rules ---
    document.addEventListener('click', function(e) {
        if (_flipIgnoreNextOutside) { _flipIgnoreNextOutside = false; return; }
        if (productsGrid && !e.target.closest('.flip-card') &&
            !e.target.closest('.subject-btn')) {
            productsGrid.classList.remove('flip-all-cards');
        }
    });

    subjectButtons.forEach(button => {
        button.addEventListener('click', function() {
            if(productsGrid) productsGrid.classList.remove('flip-all-cards');
        });
    });

    // --- Form Handling ---
    function handleFormSubmit(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const formDataObj = { formType: formId.replace('Form', '') };
            formData.forEach((value, key) => { formDataObj[key] = value; });

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Gönderiliyor...';

            try {
                const apiBase = window.API_BASE || '';
                const response = await fetch(`${apiBase}/api/contact`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formDataObj)
                });
                if (!response.ok) throw new Error("Form gönderilemedi");
                alert("Form başarıyla gönderildi ✅");
                form.reset();
                if (formId === 'trialForm') closeModal();
                if (formId === 'suggestionForm') closeSuggestionModal();
            } catch (err) {
                queueMicrotask(() => {
                    console.error("Form hatası:", err.toString());
                });
                alert("Form gönderiminde hata oluştu ❌");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Gönder';
            }
        });
    }

    handleFormSubmit("contactForm");
    handleFormSubmit("trialForm");
    handleFormSubmit("suggestionForm");

    // --- Hero Slider ---
    const slider = document.getElementById('hero-slider');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const autoplayToggle = document.getElementById('autoplayToggle');
    const slides = document.querySelectorAll('.hero-slide');
    const dotsContainer = document.querySelector('.slider-dots-container');
    
    if (slider && slides.length > 0 && dotsContainer) {
        const totalSlides = slides.length;
        let currentSlide = 0;
        let autoplayInterval;
        let isAutoplayActive = true;
        
        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.classList.add('slider-dot');
            dot.setAttribute('aria-label', `Slide ${index + 1} göster`);
            dot.addEventListener('click', () => showSlide(index));
            dotsContainer.appendChild(dot);
        });
        
        const dots = document.querySelectorAll('.slider-dot');
        
        function showSlide(index) {
            currentSlide = index >= totalSlides ? 0 : index < 0 ? totalSlides - 1 : index;
            slider.style.transform = `translateX(${-currentSlide * 100}%)`;
            dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
            resetAutoplay();
        }
        
        function nextSlide() { showSlide(currentSlide + 1); }
        function prevSlide() { showSlide(currentSlide - 1); }
        
        function startAutoplay() {
            if (isAutoplayActive) {
                autoplayInterval = setInterval(nextSlide, 10000);
                if (autoplayToggle) autoplayToggle.innerHTML = '<i class="fas fa-pause"></i>';
            }
        }
        
        function stopAutoplay() {
            clearInterval(autoplayInterval);
            if (autoplayToggle) autoplayToggle.innerHTML = '<i class="fas fa-play"></i>';
        }
        
        function resetAutoplay() {
            if (isAutoplayActive) { stopAutoplay(); startAutoplay(); }
        }
        
        function toggleAutoplay() {
            isAutoplayActive = !isAutoplayActive;
            isAutoplayActive ? startAutoplay() : stopAutoplay();
        }
        
        if (prevBtn) prevBtn.addEventListener('click', prevSlide);
        if (nextBtn) nextBtn.addEventListener('click', nextSlide);
        if (autoplayToggle) autoplayToggle.addEventListener('click', toggleAutoplay);
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prevSlide();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                toggleAutoplay();
            }
        });
        
        let touchStartX = 0;
        slider.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        slider.addEventListener('touchend', (e) => {
            const diff = e.changedTouches[0].screenX - touchStartX;
            if (Math.abs(diff) > 50) diff > 0 ? prevSlide() : nextSlide();
        }, { passive: true });
        
        if (dots.length > 0) dots[0].classList.add('active');
        startAutoplay();
        
        document.addEventListener('visibilitychange', () => {
            document.hidden ? stopAutoplay() : isAutoplayActive && startAutoplay();
        });
    }

    // --- Translation System ---
    let isTranslated = localStorage.getItem('language') === 'en';

    // Translation dictionary
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
        'Akademik Dürüstlük': 'Academic Integrity',
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



        // Legal Pages
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
        // Auth / Forms
        'Giriş Yap': 'Sign In',
        'Kayıt Ol': 'Sign Up',
        'Şifre': 'Password',
        'E-posta Adresi': 'Email Address',
        'Kurum Adı (İsteğe bağlı)': 'Institution Name (Optional)',
        'Şifreniz en az 6 karakter olmalıdır.': 'Password must be at least 6 characters.',

        // Products — SimTutor
        '✔ Tıp eğitimi simülasyon platformu': '✔ Medical education simulation platform',
        '✔ Gerçekçi hasta simülasyonları': '✔ Realistic patient simulations',
        '✔ İnteraktif klinik senaryolar': '✔ Interactive clinical scenarios',

        // Subject filters (HTML entity variants — fallback for dict lookup)
        'Fen & Matematik': 'Science & Mathematics',
        'İş & Hukuk': 'Business & Law',
    };

    // Translation apply/reset flow
    function translatePage(toEnglish) {
        const translateButton = document.getElementById('translateBtn');
        document.body.classList.add('translating');
        if (translateButton) translateButton.disabled = true;

        const translatableElements = document.querySelectorAll('[translatable], .translatable');

        translatableElements.forEach(element => {
            // Text content
            if (toEnglish) {
                // data-en öncelikli; yoksa translations dict'e fallback
                const enText = element.dataset.en;
                const originalText = element.textContent.trim();
                const resolved = enText || (originalText && translations[originalText]);
                if (resolved) {
                    element.dataset.originalText = originalText;
                    const icon = element.querySelector('i');
                    if (icon) {
                        element.innerHTML = icon.outerHTML + resolved;
                    } else {
                        element.textContent = resolved;
                    }
                }
            } else if (element.dataset.originalText) {
                const icon = element.querySelector('i');
                if (icon) {
                    element.innerHTML = icon.outerHTML + element.dataset.originalText;
                } else {
                    element.textContent = element.dataset.originalText;
                }
                delete element.dataset.originalText;
            }

            // Placeholder
            if (element.placeholder) {
                if (toEnglish) {
                    const enPh = element.dataset.enPlaceholder;
                    const originalPlaceholder = element.placeholder.trim();
                    const resolvedPh = enPh || (originalPlaceholder && translations[originalPlaceholder]);
                    if (resolvedPh) {
                        element.dataset.originalPlaceholder = originalPlaceholder;
                        element.placeholder = resolvedPh;
                    }
                } else if (element.dataset.originalPlaceholder) {
                    element.placeholder = element.dataset.originalPlaceholder;
                    delete element.dataset.originalPlaceholder;
                }
            }
        });

        const translateText = document.getElementById('translateText');
        if (translateText) translateText.textContent = toEnglish ? 'Türkçe' : 'English';

        localStorage.setItem('language', toEnglish ? 'en' : 'tr');

        setTimeout(() => {
            document.body.classList.remove('translating');
            if (translateButton) translateButton.disabled = false;
        }, 300);
    }

    function initTranslateButton() {
        const translateButton = document.getElementById('translateBtn');
        if (!translateButton || translateButton.dataset.listenerBound) return;
        translateButton.dataset.listenerBound = 'true';

        const translateText = document.getElementById('translateText');
        if (translateText) translateText.textContent = isTranslated ? 'Türkçe' : 'English';

        translateButton.addEventListener('click', () => {
            isTranslated = !isTranslated;
            translatePage(isTranslated);
        });

        if (isTranslated) translatePage(true);
    }

    initTranslateButton();
    document.addEventListener('header:ready', initTranslateButton);

    // Contact formunu auth yüklendikten sonra prefill et
    if (window.waitForAuth) {
        window.waitForAuth().then(() => prefillContactForm());
    }

    // --- CTA Shortcuts ---
    // Hero slider AI button
    setTimeout(() => {
        document.querySelectorAll('a.hero-badge[href="#products"]').forEach(link => {
            if (link.textContent.includes('Yapay Zeka') || link.querySelector('i.fa-robot')) {
                link.removeAttribute('href');
                link.style.cursor = 'pointer';
                link.onclick = function(e) {
                    e.preventDefault();
                    document.getElementById('products').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setTimeout(() => {
                        const aiFilterBtn = document.querySelector('.subject-btn[data-subject="yapay-zeka"]');
                        if (aiFilterBtn) aiFilterBtn.click();
                    }, 800);
                };
            }
        });
    }, 1000);

    // Footer filters
    const footerCategoryLinks = document.querySelectorAll('footer a[data-filter]');
    footerCategoryLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const filterValue = this.getAttribute('data-filter');
            const productsSection = document.getElementById('products');
            if (productsSection) window.scrollTo({ top: productsSection.offsetTop - 100, behavior: 'smooth' });
            setTimeout(() => {
                const filterButton = document.querySelector(`.subject-btn[data-subject="${filterValue}"]`);
                if (filterButton) {
                    document.querySelector('.subject-btn[data-subject="all"]')?.classList.remove('active');
                    document.querySelectorAll('.subject-btn.active').forEach(btn => btn.classList.remove('active'));
                    filterButton.classList.add('active');
                    if (typeof updateFilter === 'function') updateFilter();
                }
            }, 500);
        });
    });
});

// ====================== GLOBAL UI HELPERS ======================
// HTML içindeki inline onclick kullanımları için global yardımcılar
function prefillFormFromUser(fields) {
    // fields: { nameId, emailId, companyId, bannerId }
    const u = window.currentUser;
    const banner = fields.bannerId ? document.getElementById(fields.bannerId) : null;

    if (u && u.email) {
        if (fields.nameId) {
            const el = document.getElementById(fields.nameId);
            if (el) { el.value = u.full_name || ''; el.readOnly = false; }
        }
        if (fields.emailId) {
            const el = document.getElementById(fields.emailId);
            if (el) { el.value = u.email; el.readOnly = true; el.classList.add('bg-gray-50', 'cursor-not-allowed'); }
        }
        if (fields.companyId) {
            const el = document.getElementById(fields.companyId);
            if (el && u.institution) { el.value = u.institution; }
        }
        if (banner) {
            const isAdmin = u.role === 'admin' || u.role === 'super_admin';
            banner.textContent = isAdmin
                ? `${u.institution ? u.institution + ' adına g' : 'G'}önderiliyor · ${u.email}`
                : `Giriş yapıldı · ${u.email}`;
            banner.classList.remove('hidden');
        }
    } else {
        // Giriş yapılmamış: alanları temizle, editable yap
        ['nameId', 'emailId', 'companyId'].forEach(k => {
            if (!fields[k]) return;
            const el = document.getElementById(fields[k]);
            if (el) { el.value = ''; el.readOnly = false; el.classList.remove('bg-gray-50', 'cursor-not-allowed'); }
        });
        if (banner) banner.classList.add('hidden');
    }
}

function prefillContactForm() {
    const u = window.currentUser;
    if (!u || !u.email) return;
    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    if (nameEl && !nameEl.value) nameEl.value = u.full_name || '';
    if (emailEl) { emailEl.value = u.email; emailEl.readOnly = true; emailEl.classList.add('bg-gray-50', 'cursor-not-allowed'); }
}

function openModal() {
    const m = document.getElementById('trialModal');
    if (m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); }
    prefillFormFromUser({ nameId: 'trialName', emailId: 'trialEmail', companyId: 'trialCompany', bannerId: 'trialAuthBanner' });
}
function closeModal() { const m = document.getElementById('trialModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }

function openSuggestionModal() {
    const m = document.getElementById('suggestionModal');
    if (m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); }
    prefillFormFromUser({ nameId: 'suggestName', emailId: 'suggestEmail', companyId: 'suggestCompany', bannerId: 'suggestAuthBanner' });
}
function closeSuggestionModal() { const m = document.getElementById('suggestionModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }
function openMapModal() { const m = document.getElementById('mapModal'); if(m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); } }
function closeMapModal() { const m = document.getElementById('mapModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }
function toggleDropdown(button) { const list = button.nextElementSibling; if(list) { list.classList.toggle('hidden'); button.querySelector('i')?.classList.toggle('fa-chevron-down'); } }
function toggleProductsMenu() { const menu = document.getElementById('mobile-products'); if(menu) { menu.classList.toggle('hidden'); document.querySelector('#products-menu-toggle i')?.classList.toggle('fa-chevron-down'); } }

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
        
        // Mevcut hamburger click event'ini override ETME, ek davranış ekle
        const originalClickHandler = hamburger.onclick;
        hamburger.addEventListener('click', function(e) {
            // Mevcut handler'ın çalışmasına izin ver
            setTimeout(() => {
                const isActive = navLinks.classList.contains('active');
                updateMenuState(isActive);
            }, 10);
        });
        
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
    function enhanceMobileCardFlip() {
        // Sadece touch cihazlarda
        if (!('ontouchstart' in window)) return;
        
        document.querySelectorAll('.flip-card').forEach(card => {
            // Zaten event listener var mı kontrol et (çift eklemeyi önle)
            if (card.dataset.mobileFlipEnhanced) return;
            card.dataset.mobileFlipEnhanced = 'true';
            
            card.addEventListener('click', function(e) {
                // Link tıklaması değilse VE zaten flipped değilse
                if (!e.target.closest('a')) {
                    const inner = this.querySelector('.flip-inner');
                    if (inner) {
                        // Mevcut flip durumunu toggle et
                        inner.classList.toggle('flipped');
                    }
                }
            });
        });
        
        console.log('✅ Mobil kart flip geliştirmeleri aktif');
    }

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
        
        // Kart flip için DOM'un tam oturmasını bekle
        setTimeout(() => {
            enhanceMobileCardFlip();
        }, 200);
        
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