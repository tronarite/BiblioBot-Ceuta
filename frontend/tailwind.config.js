/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ecff",
          200: "#bcdfff",
          300: "#8ecbff",
          400: "#59adff",
          500: "#3389fa",
          600: "#1d69ef",
          700: "#1a54db",
          800: "#1c46b1",
          900: "#1c3d8c",
        },
      },
    },
  },
  plugins: [],
};
