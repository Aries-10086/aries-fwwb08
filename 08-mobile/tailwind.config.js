/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        seal: {
          DEFAULT: '#9e1b2b',
          deep: '#741220',
          ink: '#4a0d16',
        },
        ink: {
          DEFAULT: '#12151c',
          soft: 'rgba(18,21,28,0.68)',
        },
        paper: '#f4f6f8',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans SC"', '"Noto Sans SC"', '"PingFang SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
