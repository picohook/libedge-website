function getHeaderFallbackHtml() {
    return `
<header class="bg-primary text-white py-6 px-4">
    <div class="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center relative">
        <div class="flex flex-wrap items-center space-x-4 mb-2 sm:mb-0">
            <div class="flex items-center">
                <i class="fas fa-envelope mr-2 text-purple-300" aria-hidden="true"></i>
                <span class="text-xs sm:text-sm"><a href="mailto:info@libedge.com">info@libedge.com</a></span>
            </div>
        </div>

        <img src="assets/images/libedge_logo.webp" alt="LibEdge Logo" class="company-logo">
    </div>
</header>
<nav class="bg-white shadow-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <a class="text-2xl text-primary nav-logo" href="index.html">
            <span class="lib-bold">Lib</span><span>Edge Eğitim ve Danışmanlık</span>
        </a>
        <div class="nav-links flex items-center space-x-4 text-xs sm:text-sm font-medium text-gray-700">
            <a href="index.html#products" class="hover:text-primary font-semibold">Ürünler</a>
            <a href="index.html#brochures" class="hover:text-primary font-semibold">Broşürler</a>
            <a href="index.html#contact" class="hover:text-primary font-semibold">İletişim</a>
            <a href="announcements.html" class="hover:text-primary font-semibold">Duyurular</a>
        </div>
    </div>
</nav>`;
}

async function fetchHeaderHtml() {
    const candidates = ['/partials/header.html', 'partials/header.html'];

    for (const url of candidates) {
        try {
            const response = await fetch(url, { cache: 'no-cache' });
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn('Header fetch attempt failed:', url, error);
        }
    }

    return getHeaderFallbackHtml();
}

async function mountSharedHeader() {
    const target = document.getElementById('site-header');
    if (!target) return;

    try {
        target.innerHTML = await fetchHeaderHtml();

        const nav = target.querySelector('nav');
        if (nav) target.after(nav);

        document.dispatchEvent(new CustomEvent('header:ready', { detail: { target } }));
    } catch (error) {
        console.error('Header mount error:', error);
        target.innerHTML = getHeaderFallbackHtml();
        const nav = target.querySelector('nav');
        if (nav) target.after(nav);
    }
}

document.addEventListener('DOMContentLoaded', mountSharedHeader);
