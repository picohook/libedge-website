document.addEventListener('DOMContentLoaded', function() {
    // --- Flip Card Interaction ---
    document.querySelectorAll('.flip-card').forEach(card => {
        const flipHandler = (e) => {
            // Mobil için (768px ve altı)
            if (window.innerWidth <= 768) {
                e.preventDefault(); // Varsayılan davranışı engelle (örn. scroll)
                e.stopPropagation(); // Event bubbling'i durdur

                const flipInner = card.querySelector('.flip-inner');
                const isGlobalFlipActive = document.querySelector('.flip-all-cards');

                if (isGlobalFlipActive) {
                    // Global flip aktifse, bireysel toggle
                    flipInner.classList.toggle('flipped');
                    flipInner.style.transform = flipInner.classList.contains('flipped') ?
                        'rotateY(180deg)' :
                        'none';
                } else {
                    // Link değilse flip et
                    if (!e.target.closest('a')) {
                        flipInner.classList.toggle('flipped');
                    }
                }
            }
        };
        
        // Hem click hem touch event'leri ekle
        card.addEventListener('click', flipHandler);
        card.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Erken yakala, scroll engelle
        }, { passive: false });
        card.addEventListener('touchend', flipHandler);
    });

    // Reset cards on window resize to avoid inconsistent states
    window.addEventListener('resize', () => {
        document.querySelectorAll('.flip-inner').forEach(flipInner => {
            flipInner.classList.remove('flipped');
            flipInner.style.transform = ''; // Reset inline style
        });
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
                    document.querySelector('.subject-btn[data-subject="all"]').classList.remove('active');
                    document.querySelector('.subject-btn[data-subject="all"]').setAttribute('aria-pressed', 'false');
                    this.classList.toggle('active');
                    this.setAttribute('aria-pressed', this.classList.contains('active') ? 'true' : 'false');

                    activeSubcatOrder = activeSubcatOrder.filter(s => s !== subject);
                    if (this.classList.contains('active')) {
                        activeSubcatOrder.unshift(subject);
                    }

                    if (document.querySelectorAll('.subject-btn.active').length === 0) {
                        document.querySelector('.subject-btn[data-subject="all"]').classList.add('active');
                        document.querySelector('.subject-btn[data-subject="all"]').setAttribute('aria-pressed', 'true');
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

    // --- Brochures Link Flips All Cards ---
    const brochuresLink = document.querySelector('a[href="#brochures"]');
    if (brochuresLink && productsGrid) {
        brochuresLink.addEventListener('click', function(e) {
            e.preventDefault();
            productsGrid.classList.add('flip-all-cards');

            const productsSection = document.getElementById('products');
            if (productsSection) {
                window.scrollTo({
                    top: productsSection.offsetTop - 80,
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
            if (productsGrid) productsGrid.classList.remove('flip-all-cards');
        });
    });

    // --- Mobile Hamburger Menu ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const dropdownGroups = document.querySelectorAll('.nav-links .group');

    if (navLinks) {
        navLinks.classList.remove('active');
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            const isActive = navLinks.classList.contains('active');
            this.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            const icon = this.querySelector('i');
            if (icon) {
                icon.className = isActive ? 'fas fa-times' : 'fas fa-bars';
            }
            if (!isActive) {
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
                    e.preventDefault();
                    e.stopPropagation();
                    const wasActive = group.classList.contains('active');
                    dropdownGroups.forEach(other => other.classList.remove('active'));
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

        slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.classList.add('slider-dot');
            dot.setAttribute('aria-label', `Slide ${index + 1} göster`);
            dot.addEventListener('click', () => showSlide(index));
            dotsContainer.appendChild(dot);
        });

        const dots = document.querySelectorAll('.slider-dot');

        function showSlide(index) {
            if (index >= totalSlides) {
                currentSlide = 0;
            } else if (index < 0) {
                currentSlide = totalSlides - 1;
            } else {
                currentSlide = index;
            }

            const offset = -currentSlide * 100;
            slider.style.transform = `translateX(${offset}%)`;

            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentSlide);
            });

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
                autoplayInterval = setInterval(nextSlide, 10000);
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
            stopAutoplay();
            startAutoplay();
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', prevSlide);
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', nextSlide);
        }

        if (autoplayToggle) {
            autoplayToggle.addEventListener('click', () => {
                isAutoplayActive = !isAutoplayActive;
                if (isAutoplayActive) {
                    startAutoplay();
                } else {
                    stopAutoplay();
                }
            });
        }

        startAutoplay();
    }

    // --- Form Handling ---
    function handleFormSubmit(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", async function (e) {
            e.preventDefault();

            const formDataObj = {};
            const formData = new FormData(form);
            formData.forEach((value, key) => {
                formDataObj[key] = value;
            });

            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

            try {
                const response = await fetch("https://form-handler.agursel.workers.dev/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formDataObj)
                });

                const result = await response.json();
                if (result.success) {
                    submitBtn.innerHTML = 'Gönderildi!';
                    this.reset();

                    if (formId === "trialForm") closeModal();
                    if (formId === "suggestionForm") closeSuggestionModal();
                } else {
                    console.error("Sheets webhook hatası:", result.error);
                    alert(result.error || "Gönderim sırasında hata oluştu.");
                    submitBtn.innerHTML = 'Hata!';
                }
            } catch (error) {
                alert("Bağlantı hatası: " + error.message);
                submitBtn.innerHTML = 'Gönder';
            }

            submitBtn.disabled = false;
        });
    }

    handleFormSubmit("contactForm");
    handleFormSubmit("trialForm");
    handleFormSubmit("suggestionForm");

    // --- Translation ---
    let isTranslated = localStorage.getItem('language') === 'en';
    const translateButton = document.getElementById('translateBtn');

    const translations = {
        // Existing translations unchanged
        'Bilginin Gücünü Keşfedin': 'Discover the Power of Knowledge',
        'Kalite ve dürüstlük ilkesi ile 20 yıla yakın sektör deneyimini harmanlıyoruz. Kütüphanelere ürün danışmanlığı, abonelik süreç desteği ve yerinde eğitim hizmetleri sunuyoruz.': 
            'We blend nearly 20 years of industry experience with a commitment to quality and integrity. We offer product consulting, subscription process support, and on-site training services to libraries.',
        'Deneme Erişimi İsteği': 'Request Trial Access',
        'Ürün Öneriniz Var mı?': 'Do You Have a Product Suggestion?',
        'Öncü Yayıncılarla İş Birliği': 'Collaboration with Leading Publishers',
        'Dünyanın önde gelen akademik yayıncıları ve teknoloji sağlayıcıları ile stratejik iş birlikleri. Kurumunuz için en güncel ve nitelikli içeriğe erişin.': 
            'Strategic partnerships with the world\'s leading academic publishers and technology providers. Access the most current and high-quality content for your institution.',
        'İş Ortaklarımızı Görün': 'See Our Partners',
        'Hizmetlerimizle Tanışın': 'Explore Our Services',
        'Eğitim ve Danışmanlık Çözümleri': 'Education and Consulting Solutions',
        'Kütüphane personeli ve akademisyenler için özelleştirilmiş eğitim programları ve stratejik danışmanlık hizmetleri.': 
            'Customized training programs and strategic consulting services for library staff and academics.',
        'Hizmetlerimizi Keşfedin': 'Discover Our Services',
        'Teknoloji ve İnovasyon': 'Technology and Innovation',
        'Yapay zeka destekli araştırma araçlarından, interaktif öğrenme platformlarına kadar yenilikçi çözümler.': 
            'Innovative solutions from AI-powered research tools to interactive learning platforms.',
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
        'Seçtiğiniz kriterlere uygun ürün bulunamadı.': 'No products found matching your criteria.',
        'Gönder': 'Send',
        'Gönderiliyor...': 'Sending...',
        'Gönderildi!': 'Sent!',
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
        'İş Ortakları': 'Partners',
        'Müşteri Görüşleri': 'Customer Reviews',
        '"LibEdge ile çalışmak işlerimizi çok kolaylaştırdı. Hızlı yanıtları ve çözüm odaklı yaklaşımları sayesinde ihtiyaçlarımıza en uygun kaynaklara ulaştık."': 
            '"Working with LibEdge has made our work much easier. Thanks to their quick responses and solution-oriented approach, we accessed the most suitable resources for our needs."',
        '"Sağladıkları eğitimler çok faydalı oldu. Kullanıcılarımız artık kaynakları daha etkin kullanabiliyor. LibEdge ekibine teşekkür ederiz."': 
            '"The training they provided was very beneficial. Our users can now use the resources more effectively. Thank you to the LibEdge team."',
        '"Hizmete sunduğu kaynakların yanı sıra yeni ürünlerle ilgili danışmanlık ve yenilikçi çözümler sunma anlayışında olması nedeniyle LibEdge firması ile çalışmak her zaman avantajlı."': 
            '"Working with LibEdge is always advantageous due to their understanding of providing consulting on new products and innovative solutions alongside the resources they offer."',
        'Kütüphane Müdürü': 'Library Director',
        'Birim Sorumlusu': 'Unit Supervisor',
        'Üniversitesi': 'University',
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
        'Hızlı Linkler': 'Quick Links',
        'GİZLİLİK POLİTİKASI': 'PRIVACY POLICY',
        'KULLANIM ŞARTLARI': 'TERMS OF USE',
        '© 2025 LIBEDGE TÜM HAKLARI SAKLIDIR': '© 2025 LIBEDGE ALL RIGHTS RESERVED',
        'LibEdge ||| Daire: 2617, Adalet, Manas Blv. No: 47/B, 35530 Bayraklı/İzmir': 
            'LibEdge ||| Suite: 2617, Adalet, Manas Blv. No: 47/B, 35530 Bayraklı/Izmir',
        'Deneme Erişimi Talep Formu': 'Trial Access Request Form',
        'Ürün Öneri Formu': 'Product Suggestion Form',
        'Ad Soyad': 'Full Name',
        'E-posta': 'Email',
        'Kurum Adı': 'Institution Name',
        'Talep Detayınız': 'Your Request Details',
        'Ürün Öneri Detayınız': 'Your Product Suggestion Details',
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
        'JoVE Business': 'JoVE Business',
        '✔ İşletme ve yönetim odaklı video içeriği': '✔ Business and management-focused video content',
        '✔ Finans, Pazarlama, Mikroekonomi': '✔ Finance, Marketing, Microeconomics',
        '✔ Animasyonlu dersler': '✔ Animated lessons',
    };

    function translatePage(toEnglish) {
        document.body.classList.add('translating');
        if (translateButton) translateButton.disabled = true;

        const elements = document.querySelectorAll(
            '*:not(script):not(style):not(iframe):not(svg):not(path):not(rect):not(circle):not(g)'
        );

        elements.forEach(element => {
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

        if (translateButton) {
            const translateText = document.getElementById('translateText');
            if (translateText) {
                translateText.textContent = toEnglish ? 'Türkçe' : 'English';
            } else {
                translateButton.textContent = toEnglish ? 'Türkçe' : 'English';
            }
        }

        localStorage.setItem('language', toEnglish ? 'en' : 'tr');

        setTimeout(() => {
            document.body.classList.remove('translating');
            if (translateButton) translateButton.disabled = false;
        }, 300);
    }

    if (isTranslated && translateButton) {
        translatePage(true);
        const translateText = document.getElementById('translateText');
        if (translateText) {
            translateText.textContent = 'Türkçe';
        }
    } else if (translateButton) {
        const translateText = document.getElementById('translateText');
        if (translateText) {
            translateText.textContent = 'English';
        }
    }

    if (translateButton) {
        translateButton.addEventListener('click', () => {
            isTranslated = !isTranslated;
            translatePage(isTranslated);
        });
    }

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
});