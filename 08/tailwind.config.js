/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        seal: {
          DEFAULT: "#9e1b2b",
          deep: "#741220",
          ink: "#4a0d16",
        },
        ink: {
          DEFAULT: "#12151c",
          soft: "rgba(18,21,28,0.68)",
        },
        stone: "#e8ecf1",
        paper: "#f4f6f8",
      },
      fontFamily: {
        display: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans SC"', "sans-serif"],
        serif: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans SC"', "sans-serif"],
        sans: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans SC"', "sans-serif"],
      },
      borderRadius: {
        soft: "4px",
        card: "4px",
      },
    },
  },
  plugins: [],
};
