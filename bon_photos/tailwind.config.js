/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { cream: '#FAF7F2', ink: '#1f2937' },
      fontFamily: { sans: ['Inter','system-ui','-apple-system','Segoe UI','sans-serif'] },
      boxShadow: { soft: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)' },
    },
  },
  plugins: [],
}
