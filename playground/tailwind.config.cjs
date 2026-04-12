/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../tailwind-preset.js")],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@1click/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
}
