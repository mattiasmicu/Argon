/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        outer: 'var(--outer)',
        inner: 'var(--inner)',
        inner2: 'var(--inner2)',
        inner3: 'var(--inner3)',
        border: 'var(--border)',
        text: {
          p: 'var(--text-p)',
          s: 'var(--text-s)',
          d: 'var(--text-d)',
        },
      },
      borderRadius: {
        'shell': '18px',
        'inner': '14px',
        'card': '11px',
      },
    },
  },
  plugins: [],
}
