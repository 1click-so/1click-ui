/**
 * 1click-ui Tailwind preset — shadcn/ui standard token structure
 *
 * Uses the same CSS variable names as shadcn/ui so community themes,
 * theme generators (ui.shadcn.com/themes), and shadcn blocks work
 * out of the box. Extended with success/warning for e-commerce.
 *
 * How to consume in a store's tailwind.config.js:
 *
 *   const uiPreset = require("@1click/ui/tailwind-preset")
 *   module.exports = {
 *     presets: [uiPreset],
 *     content: [
 *       "./src/**\/*.{js,ts,jsx,tsx}",
 *       "./node_modules/@1click/ui/src/**\/*.{js,ts,jsx,tsx}"
 *     ],
 *   }
 *
 * How to set tokens in a store's globals.css:
 *
 *   :root {
 *     --background: 0 0% 100%;
 *     --foreground: 240 10% 3.9%;
 *     --primary: 24 95% 53%;
 *     --primary-foreground: 0 0% 98%;
 *     ...
 *   }
 *
 * Values are HSL channels (space-separated) so Tailwind's
 * slash-alpha syntax works: bg-primary/50, text-foreground/70.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
