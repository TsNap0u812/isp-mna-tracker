/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eaeaf5',
          100: '#d5d6eb',
          200: '#abade0',
          300: '#8183cb',
          400: '#5759b6',
          500: '#4648a1',
          600: '#3a3e7d',
          700: '#2d3068',
          800: '#252858',
          900: '#1f2148',
        },
      },
    },
  },
  plugins: [],
}
