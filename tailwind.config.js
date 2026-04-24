/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './announcements.html',
    './admin.html',
    './profile.html',
    './privacy.html',
    './terms.html',
    './cookies.html',
    './partials/**/*.html',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        // Brand primary — sidebar rengiyle aynı (#220f60). Admin panelde
        // birçok butonda `bg-primary`, `text-primary`, `border-primary`
        // ve `ra-subtab-active` style'ları bu renge güveniyor.
        primary: '#220f60',
      }
    }
  },
  plugins: []
};
