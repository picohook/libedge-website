async function mountSharedHeader() {
    const target = document.getElementById('site-header');
    if (!target) return;

    try {
        const response = await fetch('partials/header.html', { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`Header fetch failed: ${response.status}`);
        }

        target.innerHTML = await response.text();
        document.dispatchEvent(new CustomEvent('header:ready', { detail: { target } }));
    } catch (error) {
        console.error('Header mount error:', error);
    }
}

document.addEventListener('DOMContentLoaded', mountSharedHeader);
