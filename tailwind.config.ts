import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#1F2A2E",
        input: "#1F2A2E",
        ring: "#22C55E",
        background: "#080C0E",
        foreground: "#F8FAFC",
        primary: {
          DEFAULT: "#22C55E",
          foreground: "#052E16",
        },
        secondary: {
          DEFAULT: "#101619",
          foreground: "#F8FAFC",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#FEF2F2",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#1C1403",
        },
        muted: {
          DEFAULT: "#121A1D",
          foreground: "#94A3B8",
        },
        accent: {
          DEFAULT: "#16301F",
          foreground: "#86EFAC",
        },
        card: {
          DEFAULT: "#101619",
          foreground: "#F8FAFC",
        },
        popover: {
          DEFAULT: "#101619",
          foreground: "#F8FAFC",
        },
      },
      borderRadius: {
        lg: "14px",
        md: "12px",
        sm: "10px",
        xl: "16px",
        "2xl": "18px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 197, 94, 0.18)",
        card: "0 10px 40px rgba(0, 0, 0, 0.35)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
