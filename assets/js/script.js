    
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

                function updateFilter() {
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
                }

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

            // --- Partner Logo Slider (Glide.js) ---
            const partnersSliderElement = document.querySelector('.glide');
            if (partnersSliderElement) {
                new Glide('.glide', {
                    type: 'carousel',
                    autoplay: 3000,
                    perView: 6,
                    breakpoints: {
                        1024: { perView: 4 },
                        768: { perView: 3 },
                        500: { perView: 2 }
                    }
                }).mount();
            }
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
// Example for trial form
document.getElementById('trialForm').addEventListener('submit', function(e) {
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

// Example for suggestion form
document.getElementById('suggestionForm').addEventListener('submit', function(e) {
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

        }); // End of DOMContentLoaded
    

    function openModal() {
      document.getElementById('trialModal').classList.remove('hidden');
      document.body.classList.add('no-scroll');
    }
    function closeModal() {
      document.getElementById('trialModal').classList.add('hidden');
      document.body.classList.remove('no-scroll');
    }
  
    function openSuggestionModal() {
      document.getElementById('suggestionModal').classList.remove('hidden');
      document.body.classList.add('no-scroll');
    }
  
    function closeSuggestionModal() {
      document.getElementById('suggestionModal').classList.add('hidden');
      document.body.classList.remove('no-scroll');
    }


    function toggleDropdown(button) {
      const list = button.nextElementSibling;
      list.classList.toggle('hidden');
      const icon = button.querySelector('i');
      icon.classList.toggle('fa-chevron-down');
      icon.classList.toggle('fa-chevron-up');
    }

        function toggleProductsMenu() {
          const menu = document.getElementById('mobile-products');
          menu.classList.toggle('hidden');
      
          const icon = document.querySelector('#products-menu-toggle i');
          if (icon) {
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
          }
        }


// Basit çeviri sistemi - Statik çeviriler
document.addEventListener('DOMContentLoaded', function() {
    const translateButton = document.getElementById('translateBtn');
    let isTranslated = false;

    // Türkçe -> İngilizce çeviri mapping
    const translations = {
        // Başlık ve genel metinler
        'LibEdge Eğitim ve Danışmanlık': 'LibEdge Education and Consulting',
        'LibEdge ile Bilginin Gücünü Keşfedin': 'Discover the Power of Knowledge with LibEdge',
        'Kalite ve dürüstlük ilkesi ile 20 yıla yakın sektör deneyimini harmanlıyoruz. Kütüphanelere ürün danışmanlığı, abonelik süreç desteği ve yerinde eğitim hizmetleri sunuyoruz.': 
        'We blend nearly 20 years of industry experience with quality and integrity principles. We provide product consulting, subscription process support, and on-site training services to libraries.',
        
        // Navigasyon
        'Ürünler': 'Products',
        'Broşürler': 'Brochures',
        'İletişim': 'Contact',
        'Duyurular': 'Announcements',
        
        // Filtre butonları
        'Tümü': 'All',
        'Fen & Matematik': 'Science & Mathematics',
        'Mühendislik': 'Engineering',
        'Sağlık': 'Health',
        'Sosyal Bilimler': 'Social Sciences',
        'İş & Hukuk': 'Business & Law',
        'Sanat': 'Arts',
        'Yapay Zeka': 'Artificial Intelligence',
        
        // Ürün özellikleri
        'Yetkili Bölge:': 'Authorized Region:',
        'Türkiye': 'Turkey',
        'Orta Doğu': 'Middle East',
        'Türkiye (EKUAL dışı)': 'Turkey (Non-EKUAL)',
        'Broşür': 'Brochure',
        'Erişim Linki': 'Access Link',
        
        // Hizmetlerimiz
        'Hizmetlerimiz': 'Our Services',
        'Ürün Danışmanlığı ve Tedarik': 'Product Consulting and Procurement',
        'Kullanıcı ve Yönetici Eğitimleri': 'User and Administrator Trainings',
        'Erişim ve Entegrasyon Desteği': 'Access and Integration Support',
        'Koleksiyon Geliştirme Danışmanlığı': 'Collection Development Consulting',
        
        // Müşteri görüşleri
        'Müşteri Görüşleri': 'Customer Reviews',
        'İş Ortakları': 'Business Partners',
        'Bize Ulaşın': 'Contact Us',
        
        // İletişim formu
        'Adınız Soyadınız': 'Your Full Name',
        'E-posta Adresiniz': 'Your Email Address',
        'Telefon Numaranız (İsteğe Bağlı)': 'Your Phone Number (Optional)',
        'Konu': 'Subject',
        'Mesajınız': 'Your Message',
        'Gönder': 'Send',
        
        // Footer
        'Hızlı Linkler': 'Quick Links',
        'GİZLİLİK POLİTİKASI': 'PRIVACY POLICY',
        'KULLANIM ŞARTLARI': 'TERMS OF USE',
        '© 2025 LIBEDGE TÜM HAKLARI SAKLIDIR': '© 2025 LIBEDGE ALL RIGHTS RESERVED',
        
        // Modal pencereler
        'Deneme Erişimi İsteği': 'Request Trial Access',
        'Ürün Öneriniz Var mı?': 'Do You Have a Product Suggestion?',
        'Deneme Erişimi Talep Formu': 'Trial Access Request Form',
        'Ürün Öneri Formu': 'Product Suggestion Form',
        'Ad Soyad': 'Full Name',
        'E-posta': 'Email',
        'Kurum Adı': 'Institution Name',
        'Talep Detayınız': 'Your Request Details',
        'Ürün Öneri Detayınız': 'Your Product Suggestion Details'
    };

    if (translateButton) {
        translateButton.addEventListener('click', function() {
            const translatableElements = document.querySelectorAll('.translatable');
            
            translatableElements.forEach(element => {
                const originalText = element.textContent.trim();
                
                if (isTranslated) {
                    // Orijinal metne geri dön
                    if (element.dataset.originalText) {
                        element.textContent = element.dataset.originalText;
                        delete element.dataset.originalText;
                    }
                } else {
                    // İngilizce'ye çevir
                    if (translations[originalText]) {
                        element.dataset.originalText = originalText;
                        element.textContent = translations[originalText];
                    }
                }
            });
            
            isTranslated = !isTranslated;
            translateButton.textContent = isTranslated ? 'Türkçe' : 'English';
        });
    }
});
function openModal() {
  document.getElementById('trialModal').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closeModal() {
  document.getElementById('trialModal').classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function openSuggestionModal() {
  document.getElementById('suggestionModal').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closeSuggestionModal() {
  document.getElementById('suggestionModal').classList.add('hidden');
  document.body.classList.remove('no-scroll');
}

function toggleDropdown(button) {
  const list = button.nextElementSibling;
  list.classList.toggle('hidden');
  const icon = button.querySelector('i');
  icon.classList.toggle('fa-chevron-down');
  icon.classList.toggle('fa-chevron-up');
}

function toggleProductsMenu() {
  const menu = document.getElementById('mobile-products');
  menu.classList.toggle('hidden');

  const icon = document.querySelector('#products-menu-toggle i');
  if (icon) {
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
  }
}

function openMapModal() {
  document.getElementById('mapModal').classList.remove('hidden');
  document.body.classList.add('no-scroll');
}

function closeMapModal() {
  document.getElementById('mapModal').classList.add('hidden');
  document.body.classList.remove('no-scroll');
}