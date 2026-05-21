/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fb',
          400: '#36aaf6',
          500: '#0d8fe7',
          600: '#0170c5',
          700: '#0259a0',
          800: '#064c84',
          900: '#0b406e',
        },
      },
    },
  },
  plugins: [],
}
