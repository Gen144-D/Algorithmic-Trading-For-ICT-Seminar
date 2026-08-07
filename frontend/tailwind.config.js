/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0b0f1a',
          900: '#111827',
          800: '#1a2234',
          700: '#232f47',
        },
        accent: {
          DEFAULT: '#38bdf8',
          dark: '#0ea5e9',
        },
      },
    },
  },
  plugins: [],
};
