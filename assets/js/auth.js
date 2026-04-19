// ====================== AUTH YARDIMCILARI ======================
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

function getInitials(name) {
    if (!name || name === 'Kullanıcı') return 'K';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function formatInstitutionLabel(name) {
    const value = String(name || '').trim();
    if (!value) return '';
    return value;
}


function applyAvatarFallback(container, initials, avatarColor, sizeClass, textClass) {
    if (!container) return;
    container.textContent = initials;
    container.className = `${sizeClass} rounded-full flex items-center justify-center text-white font-bold ${textClass} ${avatarColor}`;
}

const API_BASE = '';
let currentUser = null;
let refreshInterval = null;
let isAuthChecking = true;
let authCheckPromise = null;
let authInitialized = false;
window.authInitialized = authInitialized;

function syncCurrentUser(user) {
    currentUser = user;
    window.currentUser = user;
}

function getAuthRoot() {
    return document.getElementById('headerAuthRoot');
}

function getAuthElement(id) {
    const authRoot = getAuthRoot();
    return authRoot?.querySelector(`#${id}`) || null;
}

function showAuthLoading(show) {
    const loadingEl = getAuthElement('authLoading');
    const notLoggedInEl = getAuthElement('authNotLoggedIn');
    const loggedInEl = getAuthElement('authLoggedIn');

    if (show) {
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
            loadingEl.classList.add('flex');
        }
        if (notLoggedInEl) notLoggedInEl.classList.add('hidden');
        if (loggedInEl) loggedInEl.classList.add('hidden');
    } else if (loadingEl) {
        loadingEl.classList.add('hidden');
        loadingEl.classList.remove('flex');
    }
}

function bindAuthForms() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm && loginForm.dataset.authBound !== 'true') {
        loginForm.dataset.authBound = 'true';
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value || '';
            const password = document.getElementById('loginPassword')?.value || '';
            await login(email, password);
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm && registerForm.dataset.authBound !== 'true') {
        registerForm.dataset.authBound = 'true';
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('regFullName')?.value || '';
            const email = document.getElementById('regEmail')?.value || '';
            const password = document.getElementById('regPassword')?.value || '';
            const institution = document.getElementById('regInstitution')?.value || '';
            await register(fullName, email, password, institution);
        });
    }
}

async function waitForAuth(timeoutMs = 10000) {
    if (authInitialized && !isAuthChecking) {
        return currentUser;
    }

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Auth initialization timeout')), timeoutMs);
    });

    try {
        await Promise.race([checkAuth(), timeoutPromise]);
        return currentUser;
    } catch (err) {
        queueMicrotask(() => {
            console.error('waitForAuth error:', err.toString());
        });
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

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (typeof window.closeLoginModal === 'function') window.closeLoginModal();
    if (typeof window.closeRegisterModal === 'function') window.closeRegisterModal();
    if (typeof window.closeModal === 'function') window.closeModal();
    if (typeof window.closeSuggestionModal === 'function') window.closeSuggestionModal();
    // Profil/admin gibi diğer sayfalardaki açık modallar
    document.querySelectorAll('.fixed.inset-0:not(.hidden)').forEach(m => {
        if (m.id === 'loginModal' || m.id === 'registerModal') return; // zaten yukarıda kapatıldı
        m.classList.add('hidden');
        document.body.classList.remove('no-scroll');
    });
});

function showNotification(message, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type || 'info');
        return;
    }
    alert(message);
}

function setAuthRedirectMessage(message, type = 'warning') {
    try {
        sessionStorage.setItem('authRedirectMsg', message);
        sessionStorage.setItem('authRedirectType', type);
    } catch (e) {
        queueMicrotask(() => {
            console.error('Session message set error:', e.toString());
        });
    }
}

function consumeAuthRedirectMessage() {
    try {
        const message = sessionStorage.getItem('authRedirectMsg');
        if (!message) return;

        const type = sessionStorage.getItem('authRedirectType') || 'warning';
        sessionStorage.removeItem('authRedirectMsg');
        sessionStorage.removeItem('authRedirectType');

        setTimeout(() => {
            showNotification(message, type);
            if (typeof window.openLoginModal === 'function') {
                window.openLoginModal();
            }
        }, 150);
    } catch (e) {
        queueMicrotask(() => {
            console.error('Session message consume error:', e.toString());
        });
    }
}

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
        }

        showNotification(data.error || 'Kayıt başarısız', 'error');
        return false;
    } catch (err) {
        queueMicrotask(() => {
            console.error('Register error:', err.toString());
        });
        showNotification('Bir hata oluştu', 'error');
        return false;
    }
};

async function login(email, password) {
    try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            let hydrated = false;
            if (data.user) {
                syncCurrentUser({
                    id: data.user.id,
                    email: data.user.email,
                    full_name: data.user.full_name,
                    institution: data.user.institution,
                    role: data.user.role
                });
            }

            try {
                await checkAuth();
                hydrated = true;
            } catch (_) {
            }

            startTokenRefresh();
            if (!hydrated) {
                updateAuthUI(true);
            }
            closeLoginModal();
            showNotification('Giriş başarılı!', 'success');
            if (!hydrated) {
                document.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: currentUser } }));
            }
            return true;
        }

        showNotification(data.error || 'Giriş başarısız', 'error');
        return false;
    } catch (e) {
        queueMicrotask(() => {
            console.error('Login error:', e.toString());
        });
        showNotification('Bir hata oluştu', 'error');
        return false;
    }
}

async function logout() {
    return logoutWithReason();
}

async function logoutWithReason(message = '', type = 'warning') {
    try {
        await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (e) {
        queueMicrotask(() => {
            console.error('Logout error:', e.toString());
        });
    }

    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    syncCurrentUser(null);
    updateAuthUI(false);
    document.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: null } }));
    if (message) {
        setAuthRedirectMessage(message, type);
    }
    window.location.href = '/';
}

async function refreshToken() {
    if (!currentUser) return false;

    try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) return true;
        if (res.status === 401) {
            await logoutWithReason('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.', 'warning');
            return false;
        }

        console.warn('Token yenileme başarısız, HTTP', res.status);
        return false;
    } catch (e) {
        queueMicrotask(() => {
            console.error('Token refresh network hatası:', e.toString());
        });
        return false;
    }
}

function startTokenRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);

    refreshInterval = setInterval(() => {
        if (currentUser) {
            refreshToken();
        }
    }, 14 * 60 * 1000);
}

async function checkAuth() {
    if (authCheckPromise) return authCheckPromise;

    showAuthLoading(true);
    isAuthChecking = true;

    authCheckPromise = (async () => {
        let isLoggedIn = false;

        try {
            const res = await fetch(`${API_BASE}/api/user/profile`, {
                credentials: 'include'
            });

            if (res.ok) {
                const user = await res.json();
                syncCurrentUser({
                    id: user.id,
                    email: user.email,
                    full_name: user.full_name,
                    institution: user.institution,
                    institution_id: user.institution_id || null,
                    institution_name: user.institution_name || null,
                    institution_logo_url: user.institution_logo_url || null,
                    institution_domain: user.institution_domain || null,
                    institution_website_url: user.institution_website_url || null,
                    role: user.role,
                    avatar_url: user.avatar_url || null
                });
                isLoggedIn = true;
                startTokenRefresh();
            } else {
                syncCurrentUser(null);
            }
        } catch (err) {
            queueMicrotask(() => {
                console.error('Auth check error:', err.toString());
            });
            syncCurrentUser(null);
        } finally {
            isAuthChecking = false;
            authInitialized = true;
            window.authInitialized = true;
            showAuthLoading(false);
            updateAuthUI(isLoggedIn);
            authCheckPromise = null;
            document.dispatchEvent(new CustomEvent('auth:ready', { detail: { user: currentUser } }));
        }
    })();

    return authCheckPromise;
}
function closeUserDropdownMenu() {
    const userDropdown = getAuthElement('userDropdown');
    if (userDropdown) {
        userDropdown.classList.add('hidden');
    }
}

window.closeUserDropdownMenu = closeUserDropdownMenu;

function updateAuthUI(isLoggedIn) {
    const authLoading = getAuthElement('authLoading');
    const authNotLoggedIn = getAuthElement('authNotLoggedIn');
    const authLoggedIn = getAuthElement('authLoggedIn');

    if (!authNotLoggedIn || !authLoggedIn) return;
    if (authLoading) authLoading.classList.add('hidden');

    if (isLoggedIn && currentUser) {
        authNotLoggedIn.classList.add('hidden');
        authLoggedIn.classList.remove('hidden');

        const initials = getInitials(currentUser.full_name);
        const avatarColor = getAvatarColor(currentUser.full_name || currentUser.email);
        const fullName = currentUser.full_name || 'Kullanıcı';

        const userAvatar = getAuthElement('userAvatar');
        const userName = getAuthElement('userName');
        const dropdownAvatar = getAuthElement('dropdownAvatar');
        const dropdownName = getAuthElement('dropdownName');
        const dropdownEmail = getAuthElement('dropdownEmail');
        const dropdownInstitution = getAuthElement('dropdownInstitution');
        const dropdownRole = getAuthElement('dropdownRole');
        const adminMenuLink = getAuthElement('adminMenuLink');

        if (userAvatar) {
            if (currentUser.avatar_url) {
                const avatarSrc = `${currentUser.avatar_url}?v=${Date.now()}`;
                userAvatar.innerHTML = `<img src="${avatarSrc}" class="w-full h-full object-cover rounded-full">`;
                userAvatar.className = 'w-7 h-7 rounded-full overflow-hidden flex items-center justify-center';
                const img = userAvatar.querySelector('img');
                if (img) {
                    img.onerror = () => applyAvatarFallback(userAvatar, initials, avatarColor, 'w-7 h-7', 'text-xs');
                }
            } else {
                applyAvatarFallback(userAvatar, initials, avatarColor, 'w-7 h-7', 'text-xs');
            }
        }
        if (userName) userName.textContent = fullName.length > 12 ? `${fullName.substring(0, 10)}..` : fullName;

        if (dropdownAvatar) {
            if (currentUser.avatar_url) {
                const avatarSrc = `${currentUser.avatar_url}?v=${Date.now()}`;
                dropdownAvatar.innerHTML = `<img src="${avatarSrc}" class="w-full h-full object-cover rounded-full">`;
                dropdownAvatar.className = 'w-[50px] h-[50px] rounded-full overflow-hidden flex items-center justify-center';
                const img = dropdownAvatar.querySelector('img');
                if (img) {
                    img.onerror = () => applyAvatarFallback(dropdownAvatar, initials, avatarColor, 'w-[50px] h-[50px]', 'text-lg');
                }
            } else {
                applyAvatarFallback(dropdownAvatar, initials, avatarColor, 'w-[50px] h-[50px]', 'text-lg');
            }
        }
        if (dropdownName) dropdownName.textContent = fullName;
        if (dropdownEmail) dropdownEmail.textContent = currentUser.email;

        const roleNameMap = {
            super_admin: 'Super Admin',
            admin: 'Kurum Yöneticisi',
            user: 'Kullanıcı'
        };
        const roleName = roleNameMap[currentUser.role] || 'Kullanıcı';

        if (dropdownRole) {
            dropdownRole.textContent = roleName;
            dropdownRole.className = `text-xs px-2 py-0.5 rounded-full ${
                currentUser.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                currentUser.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-600'
            } inline-block mt-1`;
            dropdownRole.classList.remove('hidden');
        }

        if (dropdownInstitution) dropdownInstitution.classList.add('hidden');

        if (adminMenuLink) {
            const canSeeAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
            adminMenuLink.classList.toggle('hidden', !canSeeAdmin);
        }

        // Kurum kartı — dropdown alt kısmı
        const dropdownInstSection = getAuthElement('dropdownInstSection');
        const dropdownInstName = getAuthElement('dropdownInstName');
        const dropdownInstLogoImg = getAuthElement('dropdownInstLogoImg');
        const dropdownInstInitials = getAuthElement('dropdownInstInitials');
        const instLabel = currentUser.institution_name || currentUser.institution || null;
        if (dropdownInstSection && instLabel) {
            dropdownInstSection.classList.remove('hidden');
            if (dropdownInstName) dropdownInstName.textContent = formatInstitutionLabel(instLabel);
            if (dropdownInstInitials) {
                dropdownInstInitials.textContent = '';
                dropdownInstInitials.classList.add('hidden');
            }
            const instWebsite = String(currentUser.institution_website_url || '').trim();
            const instDomain = String(currentUser.institution_domain || '').split(',')[0].trim();
            const rawInstUrl = instWebsite || instDomain;
            if (rawInstUrl) {
                const instUrl = rawInstUrl.startsWith('http') ? rawInstUrl : `https://${rawInstUrl}`;
                dropdownInstSection.href = instUrl;
                dropdownInstSection.dataset.url = instUrl;
                dropdownInstSection.style.pointerEvents = '';
            } else {
                dropdownInstSection.href = '#';
                dropdownInstSection.dataset.url = '';
                dropdownInstSection.style.pointerEvents = 'none';
            }
            if (currentUser.institution_logo_url && dropdownInstLogoImg) {
                dropdownInstLogoImg.src = currentUser.institution_logo_url;
                dropdownInstLogoImg.classList.remove('hidden');
                dropdownInstLogoImg.onerror = () => {
                    dropdownInstLogoImg.classList.add('hidden');
                };
            }
        } else if (dropdownInstSection) {
            dropdownInstSection.classList.add('hidden');
        }

        const userBadge = document.getElementById('userBadge');
        if (userBadge) userBadge.style.display = 'none';

        const userMenuBtn = getAuthElement('userMenuBtn');
        const userDropdown = getAuthElement('userDropdown');
        if (userMenuBtn && userDropdown && !userMenuBtn._listenerAdded) {
            userMenuBtn._listenerAdded = true;
userMenuBtn.addEventListener('click', function(e) {
    e.stopPropagation();

    if (window.LibEdgeNotifications?.close) {
        window.LibEdgeNotifications.close();
    }

    userDropdown.classList.toggle('hidden');
});

document.addEventListener('click', function(e) {
    if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        closeUserDropdownMenu();
    }
});

        }
    } else {
        authNotLoggedIn.classList.remove('hidden');
        authLoggedIn.classList.add('hidden');
    }
}

window.API_BASE = API_BASE;
window.waitForAuth = waitForAuth;
window.checkAuth = checkAuth;
window.updateAuthUI = updateAuthUI;
window.login = login;
window.logout = logout;

document.addEventListener('DOMContentLoaded', bindAuthForms);
document.addEventListener('header:ready', bindAuthForms);

consumeAuthRedirectMessage();



