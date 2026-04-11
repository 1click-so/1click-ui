/**
 * 1click-ui Tailwind preset
 *
 * Ships semantic tokens that every consuming store can override. The library's
 * own components use these token classes — `bg-accent`, `text-muted`, etc. —
 * so a store can repaint the entire library by setting different CSS variable
 * values in its own globals.css, without touching any library code.
 *
 * How to consume this preset in a store's tailwind.config.js:
 *
 *   const uiPreset = require("@1click/ui/tailwind-preset")
 *   module.exports = {
 *     presets: [uiPreset],
 *     content: [
 *       "./src/**\/*.{js,ts,jsx,tsx}",
 *       "./node_modules/@1click/ui/**\/*.{js,ts,jsx,tsx}"
 *     ],
 *     // ...store-specific overrides
 *   }
 *
 * How to override tokens in a store's globals.css:
 *
 *   :root {
 *     --color-accent: 221 83% 53%;   // store's brand blue
 *     --color-surface: 0 0% 100%;    // store's card background
 *     --font-display: "Lora", serif; // store's display font
 *   }
 *
 * Values are in HSL channels (space-separated) so Tailwind's slash-alpha
 * syntax works: bg-accent/50, text-muted/70, etc.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        "accent-fg": "hsl(var(--color-accent-fg) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        "surface-muted": "hsl(var(--color-surface-muted) / <alpha-value>)",
        border: "hsl(var(--color-border) / <alpha-value>)",
        "text-base": "hsl(var(--color-text-base) / <alpha-value>)",
        "text-muted": "hsl(var(--color-text-muted) / <alpha-value>)",
        "text-subtle": "hsl(var(--color-text-subtle) / <alpha-value>)",
        success: "hsl(var(--color-success) / <alpha-value>)",
        warning: "hsl(var(--color-warning) / <alpha-value>)",
        danger: "hsl(var(--color-danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm: "calc(var(--radius) - 4px)",
        md: "calc(var(--radius) - 2px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
      },
    },
  },
  plugins: [],
}
