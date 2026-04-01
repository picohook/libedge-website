// ====================== KULLANICI MENÜSÜ YARDIMCILARI ======================

// Kullanıcı avatarı için renk üretme
function getAvatarColor(name) {
    const colors = ['avatar-purple', 'avatar-blue', 'avatar-green', 'avatar-orange', 'avatar-pink', 'avatar-cyan'];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = ((hash << 5) - hash) + name.charCodeAt(i);
        hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
}

// İsimden baş harfleri al (maks 2 harf)
function getInitials(name) {
    if (!name || name === 'Kullanıcı') return '👤';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Kısa isim (maksimum 15 karakter)
function getShortName(name) {
    if (!name || name === 'Kullanıcı') return 'Kullanıcı';
    if (name.length > 15) return name.substring(0, 12) + '...';
    return name;
}

// ====================== AUTH GLOBAL FUNCTIONS ======================
const API_BASE = 'https://form-handler.agursel.workers.dev';
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Token decode helper (Türkçe karakterler için)
function decodeToken(token) {
    try {
        const decoded = decodeURIComponent(escape(atob(token)));
        return JSON.parse(decoded);
    } catch (e) {
        console.error("Token decode error:", e);
        return null;
    }
}

window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
};

window.openRegisterModal = function() {
    closeLoginModal();
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.classList.add('no-scroll');
    }
};

window.closeRegisterModal = function() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    }
};

// Login function - GÜNCELLENDİ (decodeToken ile)
window.login = async function(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            
            // Token'ı decode et
            const decoded = decodeToken(authToken);
            if (decoded) {
                currentUser = {
                    id: decoded.user_id,
                    email: decoded.email,
                    full_name: decoded.full_name,
                    institution: decoded.institution,
                    role: decoded.role
                };
            } else {
                currentUser = data.user;
            }
            
            updateAuthUI(true);
            closeLoginModal();
            showNotification('Giriş başarılı! Hoş geldiniz, ' + (currentUser.full_name || 'Kullanıcı'), 'success');
            return true;
        } else {
            showNotification(data.error || 'Giriş başarısız', 'error');
            return false;
        }
    } catch (err) {
        console.error('Login error:', err);
        showNotification('Bir hata oluştu', 'error');
        return false;
    }
};

// Register function
window.register = async function(fullName, email, password, institution) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, password, institution })
        });
        const data = await response.json();
        if (data.success) {
            showNotification(data.message, 'success');
            closeRegisterModal();
            openLoginModal();
            return true;
        } else {
            showNotification(data.error || 'Kayıt başarısız', 'error');
            return false;
        }
    } catch (err) {
        console.error('Register error:', err);
        showNotification('Bir hata oluştu', 'error');
        return false;
    }
};

// Logout function
window.logout = function() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateAuthUI(false);
    showNotification('Çıkış yapıldı', 'info');
};

// Update UI based on auth state
// Kullanıcı arayüzünü güncelle (Hover versiyon)
function updateAuthUI(isLoggedIn) {
    const authNotLoggedIn = document.getElementById('authNotLoggedIn');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownName = document.getElementById('dropdownName');
    const dropdownEmail = document.getElementById('dropdownEmail');
    const dropdownInstitution = document.getElementById('dropdownInstitution');
    const dropdownRole = document.getElementById('dropdownRole');
    const adminMenuLink = document.getElementById('adminMenuLink');
    
    if (isLoggedIn && currentUser) {
        if (authNotLoggedIn) authNotLoggedIn.classList.add('hidden');
        if (authLoggedIn) authLoggedIn.classList.remove('hidden');
        
        const initials = getInitials(currentUser.full_name);
        const avatarColor = getAvatarColor(currentUser.full_name || currentUser.email);
        const fullName = currentUser.full_name || 'Kullanıcı';
        
        // Avatar ve isim güncelleme
        if (userAvatar) {
            userAvatar.textContent = initials;
            userAvatar.className = `w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor}`;
        }
        if (userName) userName.textContent = fullName.length > 12 ? fullName.substring(0, 10) + '..' : fullName;
        
        // Dropdown bilgileri
        if (dropdownAvatar) {
            dropdownAvatar.textContent = initials;
            dropdownAvatar.className = `w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${avatarColor}`;
        }
        if (dropdownName) dropdownName.textContent = fullName;
        if (dropdownEmail) dropdownEmail.textContent = currentUser.email;
        
        // Rol gösterimi
        const roleName = {
            'super_admin': 'Super Admin',
            'admin': 'Kurum Yöneticisi',
            'user': 'Kullanıcı'
        }[currentUser.role] || 'Kullanıcı';
        
        if (dropdownRole) {
            dropdownRole.textContent = roleName;
            dropdownRole.className = `text-xs px-2 py-0.5 rounded-full ${
                currentUser.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                currentUser.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-600'
            } inline-block mt-1`;
            dropdownRole.classList.remove('hidden');
        }
        
        // Kurum bilgisi
        if (dropdownInstitution) {
            if (currentUser.institution) {
                const instSpan = dropdownInstitution.querySelector('span');
                if (instSpan) instSpan.textContent = currentUser.institution;
                dropdownInstitution.classList.remove('hidden');
            } else {
                dropdownInstitution.classList.add('hidden');
            }
        }
        
        // Admin menü linki
        if (adminMenuLink) {
            if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
                adminMenuLink.classList.remove('hidden');
            } else {
                adminMenuLink.classList.add('hidden');
            }
        }
        
        const userBadge = document.getElementById('userBadge');
        if (userBadge) userBadge.style.display = 'none';
        
        // Dropdown tıklama olayı
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        if (userMenuBtn && userDropdown && !userMenuBtn._listenerAdded) {
            userMenuBtn._listenerAdded = true;
            userMenuBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                userDropdown.classList.toggle('hidden');
            });
            document.addEventListener('click', function(e) {
                if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.add('hidden');
                }
            });
        }
        
    } else {
        if (authNotLoggedIn) authNotLoggedIn.classList.remove('hidden');
        if (authLoggedIn) authLoggedIn.classList.add('hidden');
    }
}
// Dil butonu event'ini nav'daki butona bağla
document.addEventListener('DOMContentLoaded', function() {
    const translateBtnMain = document.getElementById('translateBtn');
    const translateBtnNav = document.getElementById('translateBtnNav');
    const translateTextMain = document.getElementById('translateText');
    const translateTextNav = document.getElementById('translateTextNav');
    
    // Ana dil butonu event'ini nav butonuna kopyala
    if (translateBtnMain && translateBtnNav) {
        translateBtnNav.addEventListener('click', function() {
            translateBtnMain.click();
        });
    }
    
    // Çeviri metnini senkronize et
    function syncTranslateText() {
        if (translateTextMain && translateTextNav) {
            translateTextNav.textContent = translateTextMain.textContent;
        }
    }
    
    // Her çeviri değiştiğinde senkronize et
    const observer = new MutationObserver(syncTranslateText);
    if (translateTextMain) observer.observe(translateTextMain, { childList: true, characterData: true, subtree: true });
    syncTranslateText();
});

// Check authentication - GÜNCELLENDİ (decodeToken ile)
async function checkAuth() {
    if (!authToken) return false;

    try {
        const decoded = decodeToken(authToken);
        
        if (decoded && decoded.exp > Date.now()) {
            currentUser = {
                id: decoded.user_id,
                email: decoded.email,
                full_name: decoded.full_name,
                institution: decoded.institution,
                role: decoded.role
            };
            updateAuthUI(true);
            return true;
        } else {
            logout();
            return false;
        }
    } catch (err) {
        console.error('Auth check error:', err);
        logout();           // Güvenlik için logout öneririm
        return false;
    }
}
    if (!authToken) return false;
    try {
        const decoded = decodeToken(authToken);
        if (decoded && decoded.exp > Date.now()) {
    currentUser = {
        id: decoded.user_id,
        email: decoded.email,
        full_name: decoded.full_name,
        institution: decoded.institution,
        role: decoded.role  // ← BU SATIRI EKLEYİN
    };
    updateAuthUI(true);
    return true;
}
        } else {
            logout();
            return false;
        }
    } catch (err) {
        console.error('Auth check error:', err);
        return false;
    }
}

function showNotification(message, type) {
    alert(message);
}

// ====================== TEK DOMContentLoaded ======================
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded - initializing site");
    
    // Auth kontrolü
    checkAuth();
    
    // Login form
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
    
    // --- Flip Card Interaction ---
    document.querySelectorAll('.flip-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.tagName.toLowerCase() === 'a') return;
            this.querySelector('.flip-inner').classList.toggle('flipped');
        });
    });

    // Reset cards on window resize
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

    // --- Back to Top Button ---
    const backToTopButton = document.getElementById('backToTop');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            backToTopButton.classList.toggle('visible', window.pageYOffset > 300);
        });
        backToTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // --- "Brochures" Link Flips All Cards ---
    const brochuresLink = document.querySelector('a[href="#brochures"]');
    if (brochuresLink && productsGrid) {
        brochuresLink.addEventListener('click', function(e) {
            e.preventDefault();
            productsGrid.classList.add('flip-all-cards');
            const productsSection = document.getElementById('products');
            if (productsSection) window.scrollTo({ top: productsSection.offsetTop - 80, behavior: 'smooth' });
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

    // --- Mobile Menu ---
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const dropdownGroups = document.querySelectorAll('.nav-links .group');

    if (navLinks) navLinks.classList.remove('active');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            navLinks.classList.toggle('active');
            const isActive = navLinks.classList.contains('active');
            this.setAttribute('aria-expanded', isActive ? 'true' : 'false');
            const icon = this.querySelector('i');
            if (icon) icon.className = isActive ? 'fas fa-times' : 'fas fa-bars';
            if (!isActive) dropdownGroups.forEach(group => group.classList.remove('active'));
        });
    }

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

    // --- Navigation Dropdown Links ---
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
                const response = await fetch("https://form-handler.agursel.workers.dev/", {
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
                console.error("Form hatası:", err);
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

    function translatePage(toEnglish) {
        document.body.classList.add('translating');
        if (translateButton) translateButton.disabled = true;

        const translatableElements = document.querySelectorAll('[translatable], .translatable');
        
        translatableElements.forEach(element => {
            if (element.textContent.trim()) {
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
        });

        if (translateButton) {
            const translateText = document.getElementById('translateText');
            if (translateText) translateText.textContent = toEnglish ? 'Türkçe' : 'English';
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
        if (translateText) translateText.textContent = 'Türkçe';
    } else if (translateButton) {
        const translateText = document.getElementById('translateText');
        if (translateText) translateText.textContent = 'English';
    }

    if (translateButton) {
        translateButton.addEventListener('click', () => {
            isTranslated = !isTranslated;
            translatePage(isTranslated);
        });
    }

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

// --- Global Modal Functions ---
function openModal() { const m = document.getElementById('trialModal'); if(m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); } }
function closeModal() { const m = document.getElementById('trialModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }
function openSuggestionModal() { const m = document.getElementById('suggestionModal'); if(m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); } }
function closeSuggestionModal() { const m = document.getElementById('suggestionModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }
function openMapModal() { const m = document.getElementById('mapModal'); if(m) { m.classList.remove('hidden'); document.body.classList.add('no-scroll'); } }
function closeMapModal() { const m = document.getElementById('mapModal'); if(m) { m.classList.add('hidden'); document.body.classList.remove('no-scroll'); } }
function toggleDropdown(button) { const list = button.nextElementSibling; if(list) { list.classList.toggle('hidden'); button.querySelector('i')?.classList.toggle('fa-chevron-down'); } }
function toggleProductsMenu() { const menu = document.getElementById('mobile-products'); if(menu) { menu.classList.toggle('hidden'); document.querySelector('#products-menu-toggle i')?.classList.toggle('fa-chevron-down'); } }

