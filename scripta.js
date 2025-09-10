/* Modal kontrolü (global, onclick ile çağrılıyor) */
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

/* Harita modal kapatma */
function closeMapModal() {
  const m = document.getElementById('mapModal');
  if (m) {
    m.classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }
}

/* Dropdown / mobile ürün menüsü fonksiyonları (global) */
function toggleDropdown(button) {
  const list = button.nextElementSibling;
  if (list) list.classList.toggle('hidden');
  const icon = button.querySelector('i');
  if (icon) {
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
  }
}

function toggleProductsMenu() {
  const menu = document.getElementById('mobile-products');
  if (menu) menu.classList.toggle('hidden');

  const icon = document.querySelector('#products-menu-toggle i');
  if (icon) {
    icon.classList.toggle('fa-chevron-down');
    icon.classList.toggle('fa-chevron-up');
  }
}

// Global değişkenler
let productsGrid = null;
let productCards = [];
let originalOrder = [];
let activeSubcatOrder = [];

// Filtreleme fonksiyonu (global olarak erişilebilir olmalı)
function updateFilter() {
  if (!productsGrid) return;
  
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
}

/* Ana etkileşimler */
document.addEventListener('DOMContentLoaded', function() {
  // Global değişkenleri başlat
  productsGrid = document.getElementById('products-grid');
  
  if (productsGrid) {
    productCards = Array.from(productsGrid.querySelectorAll('.product-card-container'));
    originalOrder = [...productCards];
  }
  
  activeSubcatOrder = [];

  // --- Flip Card Interaction ---
  document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (window.innerWidth <= 1280) {
        const flipInner = card.querySelector('.flip-inner');
        const isGlobalFlipActive = document.querySelector('.flip-all-cards');

        if (isGlobalFlipActive) {
          flipInner.classList.toggle('flipped');
          flipInner.style.transform = flipInner.classList.contains('flipped') ? 'rotateY(180deg)' : 'none';
        } else {
          if (!e.target.closest('a')) {
            flipInner.classList.toggle('flipped');
          }
        }
      }
    });
  });

  // Reset cards on resize
  window.addEventListener('resize', () => {
    document.querySelectorAll('.flip-inner').forEach(flipInner => {
      flipInner.classList.remove('flipped');
      flipInner.style.transform = '';
    });
    if (productsGrid) productsGrid.classList.remove('flip-all-cards');
  });

  // --- Product Filtering ---
  const subjectButtons = document.querySelectorAll('.subject-btn');

  if (productsGrid && subjectButtons.length > 0) {
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
          const allBtn = document.querySelector('.subject-btn[data-subject="all"]');
          if (allBtn) {
            allBtn.classList.remove('active');
            allBtn.setAttribute('aria-pressed', 'false');
          }
          this.classList.toggle('active');
          this.setAttribute('aria-pressed', this.classList.contains('active') ? 'true' : 'false');

          activeSubcatOrder = activeSubcatOrder.filter(s => s !== subject);
          if (this.classList.contains('active')) activeSubcatOrder.unshift(subject);

          if (document.querySelectorAll('.subject-btn.active').length === 0) {
            if (allBtn) {
              allBtn.classList.add('active');
              allBtn.setAttribute('aria-pressed', 'true');
            }
          }
        }
        updateFilter();
      });
    });

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

  // --- "Brochures" Link Flips All Cards ---
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
          setTimeout(() => flipInner.classList.remove('flipped'), 3000);
        }
      }
    });
  });

  // --- Deneme & Öneri Formları (örnek simülasyon) ---
  const trialForm = document.getElementById('trialForm');
  if (trialForm) {
    trialForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

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

  const suggestionForm = document.getElementById('suggestionForm');
  if (suggestionForm) {
    suggestionForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const submitBtn = this.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gönderiliyor...';

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
          if (!wasActive) group.classList.add('active');
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
        const hi = hamburger.querySelector('i');
        if (hi) hi.className = 'fas fa-bars';
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
        const hi = hamburger.querySelector('i');
        if (hi) hi.className = 'fas fa-bars';
      }
      dropdownGroups.forEach(group => group.classList.remove('active'));
    }
  });

  // =======================================================================
  //          CLOUDFLARE WORKER UYUMLU ÇEVİRİ KODU
  // =======================================================================
  const translateButton = document.getElementById('translateBtn');
  if (translateButton) {
    const originalTexts = new Map();
    let isTranslated = false;
    const workerUrl = 'https://silent-mountain-f3bf.agursel.workers.dev/';

    translateButton.innerText = 'English';

    const collectAndStoreOriginalTexts = () => {
      if (originalTexts.size === 0) {
        const elements = document.querySelectorAll('.translatable');
        elements.forEach(el => {
          originalTexts.set(el, el.innerText.trim());
        });
      }
    };

    const revertToOriginal = () => {
      originalTexts.forEach((text, el) => {
        el.innerText = text;
      });
    };

    const translateAllTexts = async (targetLanguage) => {
      collectAndStoreOriginalTexts();
      const elementsToTranslate = Array.from(originalTexts.keys());
      const translationPromises = [];

      for (const el of elementsToTranslate) {
        const originalText = originalTexts.get(el);
        if (!originalText) continue;

        const promise = fetch(`${workerUrl}?text=${encodeURIComponent(originalText)}&target=${targetLanguage}`)
          .then(res => {
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            return res.json();
          })
          .then(data => {
            if (data.error) {
              console.error('Translation error:', data.error);
              return originalText;
            }
            return data.data.translations[0].translatedText;
          })
          .catch(err => {
            console.error('Fetch error:', err.message);
            return originalText;
          });

        translationPromises.push(promise);
      }

      try {
        const translatedTexts = await Promise.all(translationPromises);
        elementsToTranslate.forEach((el, index) => {
          if (translatedTexts[index]) el.innerText = translatedTexts[index];
        });
      } catch (error) {
        console.error('An error occurred during translations:', error);
        alert('Çeviri hizmeti şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.');
        revertToOriginal();
      }
    };

    translateButton.addEventListener('click', async function() {
      translateButton.innerText = 'Yükleniyor...';
      translateButton.disabled = true;

      if (!isTranslated) {
        await translateAllTexts('en');
        translateButton.innerText = 'Türkçe';
        isTranslated = true;
      } else {
        revertToOriginal();
        translateButton.innerText = 'English';
        isTranslated = false;
      }

      translateButton.disabled = false;
    });
  }

}); // End DOMContentLoaded