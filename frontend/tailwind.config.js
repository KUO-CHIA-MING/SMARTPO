/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 提供極致高質感的 HSL 莫蘭迪協調配色
        morandi: {
          orange: 'hsl(24, 95%, 62%)', // 橘黃色 🟠
          red: 'hsl(4, 90%, 58%)',    // 紅色 🔴
          yellow: 'hsl(45, 98%, 50%)', // 黃色 🟡
          green: 'hsl(142, 70%, 45%)', // 綠色 🟢
          blue: 'hsl(217, 91%, 60%)',  // 藍色 🔵
          dark: 'hsl(222, 47%, 11%)',  // 暗色背景
          slate: 'hsl(210, 40%, 96%)', // 淺色背景
        }
      }
    },
  },
  plugins: [],
}
