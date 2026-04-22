/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette pastel inspirée de cartes régionales
        cream: '#FAF7F2',
        ink: '#1f2937',
        region: {
          dakar:       '#FEE2E2', // rose pastel
          thies:       '#DBEAFE', // bleu pastel
          diourbel:    '#FEF3C7', // ambre pastel
          fatick:      '#DCFCE7', // vert menthe
          kaolack:     '#FCE7F3', // rose poudré
          kaffrine:    '#E0E7FF', // lavande
          louga:       '#FFEDD5', // pêche
          matam:       '#CFFAFE', // cyan pastel
          'saint-louis': '#F3E8FF', // mauve
          tamba:       '#FEF9C3', // jaune pastel
          sedhiou:     '#D1FAE5', // émeraude pastel
          kolda:       '#E0F2FE', // ciel
          kedougou:    '#FFE4E6', // corail
          ziguinchor:  '#EDE9FE', // violet pastel
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}
