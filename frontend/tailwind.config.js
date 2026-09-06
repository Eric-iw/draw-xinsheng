/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        ink: '#4b4b4b',
        pink: '#f3b5c9',
        blue: '#7899dc',
        purple: '#927dcc',
        yellow: '#f5c75f',
      },
      borderRadius: {
        lg: '8px',
      },
      fontFamily: {
        sans: ['AlimamaShuHeiTi', 'Arial', 'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
