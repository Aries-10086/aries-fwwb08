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
          DEFAULT: "#a31828",
          deep: "#7a1020",
          ink: "#4a0a14",
        },
        ink: {
          DEFAULT: "#0e1116",
          soft: "rgba(14,17,22,0.72)",
        },
        brass: "#8a6a2f",
        stone: "#e8ebef",
        paper: "#f3f5f7",
      },
      fontFamily: {
        display: ['"ZCOOL XiaoWei"', '"Noto Serif SC"', "Songti SC", "serif"],
        serif: ['"Noto Serif SC"', "Songti SC", "serif"],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
