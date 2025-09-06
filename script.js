    
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
      

// =======================================================================
//          CLOUDFLARE WORKER UYUMLU ÇEVİRİ KODU
// =======================================================================

document.addEventListener('DOMContentLoaded', function() {
    const translateButton = document.getElementById('translateBtn');
    const originalTexts = new Map();
    let isTranslated = false;
    const workerUrl = 'https://silent-mountain-f3bf.agursel.workers.dev/'; // Size verilen Worker URL'si

    // Sayfa ilk yüklendiğinde buton metnini ayarla
    translateButton.innerText = 'English';

    // Orijinal metinleri sadece bir kez topla ve sakla
    const collectAndStoreOriginalTexts = () => {
        if (originalTexts.size === 0) {
            const elements = document.querySelectorAll('.translatable');
            elements.forEach(el => {
                // Elementin kendisini anahtar, temizlenmiş metnini değer olarak sakla
                originalTexts.set(el, el.innerText.trim());
            });
        }
    };

    // Saklanan orijinal metinlere geri dön
    const revertToOriginal = () => {
        originalTexts.forEach((text, el) => {
            el.innerText = text;
        });
    };

    // Tüm metinleri Cloudflare Worker kullanarak çevir
    const translateAllTexts = async (targetLanguage) => {
        collectAndStoreOriginalTexts();

        const elementsToTranslate = Array.from(originalTexts.keys());
        const translationPromises = []; // Tüm çeviri isteklerini tutacak dizi

        for (const el of elementsToTranslate) {
            const originalText = originalTexts.get(el);

            // Eğer metin boşsa çeviri isteği yapma
            if (!originalText) {
                continue;
            }

            // Her bir metin için ayrı bir çeviri isteği oluştur ve diziye ekle
            const promise = fetch(`${workerUrl}?text=${encodeURIComponent(originalText)}&target=${targetLanguage}`)
                .then(res => {
                    if (!res.ok) {
                        throw new Error(`Server error: ${res.status}`);
                    }
                    return res.json();
                })
                .then(data => {
                    if (data.error) {
                        // Bir hata varsa, orijinal metni koru
                        console.error('Translation error:', data.error);
                        return originalText;
                    }
                    // Başarılı çeviriyi döndür
                    return data.data.translations[0].translatedText;
                })
                .catch(err => {
                    // İstek sırasında hata olursa orijinal metni koru
                    console.error('Fetch error:', err.message);
                    return originalText; // Hata durumunda orijinal metni kullan
                });

            translationPromises.push(promise);
        }

        try {
            // Tüm çeviri isteklerinin tamamlanmasını bekle
            const translatedTexts = await Promise.all(translationPromises);

            // Sonuçları ilgili elementlere yazdır
            elementsToTranslate.forEach((el, index) => {
                // Çevirisi yapılamayan (boş olanlar atlandığı için)
                // veya hata alan metinler orijinal kalacağından,
                // burada sadece başarılı olanlar güncellenir.
                if(translatedTexts[index]){
                   el.innerText = translatedTexts[index];
                }
            });

        } catch (error) {
            console.error('An error occurred during translations:', error);
            alert('Çeviri hizmeti şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
            revertToOriginal(); // Herhangi bir büyük hata durumunda tüm metinleri geri al
        }
    };

    // Çeviri butonuna tıklama olayını dinle
    translateButton.addEventListener('click', async function() {
        translateButton.innerText = 'Yükleniyor...';
        translateButton.disabled = true;

        if (!isTranslated) {
            await translateAllTexts('en'); // İngilizce'ye çevir
            translateButton.innerText = 'Türkçe';
            isTranslated = true;
        } else {
            revertToOriginal(); // Orijinal dile (Türkçe) geri dön
            translateButton.innerText = 'English';
            isTranslated = false;
        }

        translateButton.disabled = false;
    });
});
