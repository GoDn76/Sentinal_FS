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
        surface: {
          DEFAULT: '#0b1326',
          lowest: '#060e20',
          low: '#131b2e',
          medium: '#171f33',
          high: '#222a3d',
          highest: '#2d3449'
        },
        primary: {
          DEFAULT: '#4fdbc8',
          container: '#14b8a6',
          dark: '#003731'
        },
        secondary: {
          DEFAULT: '#adc6ff',
          container: '#0566d9'
        },
        tertiary: {
          DEFAULT: '#4edea3',
          container: '#16bb83'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
