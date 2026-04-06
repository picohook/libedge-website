// assets/js/header.js

const HEADER_HTML = `
<header class="bg-primary text-white py-6 px-4">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center relative">
        <div class="flex flex-wrap items-center space-x-4 mb-2 sm:mb-0">
            <div class="flex items-center">
                <i class="fas fa-envelope mr-2 text-purple-300" aria-hidden="true"></i>
                <span class="text-xs sm:text-sm">
                    <a href="mailto:info@libedge.com">info@libedge.com</a>
                </span>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center">
                    <i class="fas fa-mobile-alt mr-2 text-purple-300" aria-hidden="true"></i>
                    <span class="text-xs sm:text-sm">+90 535 624 4016</span>
                </div>
                <div class="flex items-center mt-1">
                    <i class="fas fa-mobile-alt mr-2 text-purple-300" aria-hidden="true"></i>
                    <span class="text-xs sm:text-sm">+90 530 353 3932</span>
                </div>
            </div>
        </div>

        <img src="assets/images/libedge_logo.webp" alt="LibEdge Logo" class="company-logo">

        <div class="flex items-center space-x-4 ml-auto">
            <a class="text-white hover:text-purple-300" href="https://www.linkedin.com/company/libedge-consultancy-services/" target="_blank"><i class="fab fa-linkedin-in text-lg"></i></a>
            <a class="text-white hover:text-purple-300" href="https://twitter.com/" target="_blank"><i class="fab fa-x-twitter text-lg"></i></a>
            <a class="text-white hover:text-purple-300" href="https://facebook.com/" target="_blank"><i class="fab fa-facebook-f text-lg"></i></a>
            <a class="text-white hover:text-purple-300" href="https://instagram.com/" target="_blank"><i class="fab fa-instagram text-lg"></i></a>
            <a class="text-white hover:text-purple-300" href="https://youtube.com/" target="_blank"><i class="fab fa-youtube text-lg"></i></a>
            <a class="text-white hover:text-purple-300 cursor-pointer" onclick="openMapModal()"><i class="fas fa-map-marker-alt text-lg"></i></a>

            <div class="ml-auto pl-8">
                <div id="authNotLoggedIn">
                    <a class="text-white hover:text-purple-300 cursor-pointer" onclick="openLoginModal()" aria-label="User Management">
                        <i class="fas fa-user text-xl"></i>
                    </a>
                </div>
                <div id="authLoggedIn" class="relative hidden">
                    <div class="group">
                        <div id="userMenuBtn" class="flex items-center gap-2 cursor-pointer">
                            <div id="userAvatar" class="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-bold">AG</div>
                            <i class="fas fa-chevron-down text-xs transition-transform group-hover:rotate-180"></i>
                        </div>
                        <div id="userDropdown" class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg overflow-hidden opacity-0 invisible transition-all duration-200 transform -translate-y-2 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0" style="transform-origin: top right; z-index: 50;">
                            <div class="bg-gradient-to-r from-[#220f60] to-purple-700 p-4 text-white">
                                <div class="flex items-center gap-3">
                                    <div id="dropdownAvatar" class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold">AG</div>
                                    <div class="flex-1 min-w-0">
                                        <p id="dropdownName" class="font-semibold text-white truncate"></p>
                                        <p id="dropdownEmail" class="text-xs text-purple-200 truncate"></p>
                                        <p id="dropdownRole" class="text-xs mt-1 hidden"></p>
                                        <p id="dropdownInstitution" class="text-xs text-purple-300 truncate mt-1 hidden">
                                            <i class="fas fa-building mr-1"></i><span></span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div class="py-2">
                                <a href="profile.html" class="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50"><i class="fas fa-user-circle w-5 text-gray-400"></i>Profilim</a>
                                <div id="adminMenuLink" class="hidden"><a href="admin.html" class="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50"><i class="fas fa-shield-alt w-5 text-purple-500"></i>Admin Paneli</a></div>
                                <hr class="my-1 mx-4 border-gray-100">
                                <button onclick="logout()" class="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50"><i class="fas fa-sign-out-alt w-5"></i>Çıkış Yap</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</header>

<nav class="bg-white shadow-md sticky top-0 z-10">
    <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <a class="text-2xl text-primary nav-logo" href="index.html">
            <span class="lib-bold">Lib</span><span>Edge Eğitim ve Danışmanlık</span>
        </a>
        <button class="hamburger" aria-label="Menüyü aç/kapat" aria-expanded="false">
            <i class="fas fa-bars"></i>
        </button>
        <div class="nav-links flex items-center space-x-2 sm:space-x-6 text-xs sm:text-sm font-medium text-gray-700">
            <a class="hover:text-primary" href="index.html#products">Ürünler</a>
            <a class="hover:text-primary" href="index.html#brochures">Broşürler</a>
            <a class="hover:text-primary" href="index.html#contact">İletişim</a>
            <a class="hover:text-primary" href="Announcements.html">Duyurular</a>
            <button id="translateBtn" class="bg-primary text-white px-3 py-1.5 rounded-md hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center text-sm font-semibold">
                <i class="fas fa-globe mr-1"></i>
                <span id="translateText">English</span>
            </button>
        </div>
    </div>
</nav>
`;

// Sayfaya enjekte et
document.addEventListener('DOMContentLoaded', () => {
    const target = document.getElementById('site-header');
    if (target) target.innerHTML = HEADER_HTML;
});
<div class="ml-auto pl-8">
    <div id="authLoading" class="hidden">
        <i class="fas fa-spinner fa-spin text-white text-xl"></i>
    </div>
    <div id="authNotLoggedIn"></div>