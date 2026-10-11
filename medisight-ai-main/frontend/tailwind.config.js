/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep maroon → rose. 600 is the primary button, 400 is the soft
        // rose used for the header call-to-action.
        wine: {
          50: '#FDF5F5',
          100: '#F8E7E8',
          200: '#F1CDD1',
          300: '#E6A6AD',
          400: '#DA7580',
          500: '#B93A55',
          600: '#9A2445',
          700: '#7A1A36',
          800: '#5E1229',
          900: '#3F0C1C',
        },
        // Warm near-blacks with a wine undertone (sidebar, dark sections).
        ink: {
          950: '#150A0D',
          900: '#1B0F12',
          800: '#26141A',
          700: '#3A222A',
          600: '#5B4148',
          500: '#7C6268',
          400: '#9C868B',
          300: '#BFAEB1',
        },
        blush: {
          50: '#FDF8F7',
          100: '#FBF0EF',
          200: '#F6E3E2',
          300: '#EFD3D2',
        },
        crimson: { 50: '#FCEBEE', 500: '#C02A48', 700: '#8F1B34' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(74, 20, 34, 0.04), 0 10px 28px -12px rgba(74, 20, 34, 0.14)',
        lift: '0 2px 4px rgba(74, 20, 34, 0.06), 0 22px 44px -18px rgba(74, 20, 34, 0.28)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        drift: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        breathe: 'breathe 5s ease-in-out infinite',
        drift: 'drift 140s linear infinite',
      },
    },
  },
  plugins: [],
}
