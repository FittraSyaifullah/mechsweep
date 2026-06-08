import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/globals.css",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f8fafc",
          subtle: "#f1f5f9",
        },
        ink: {
          DEFAULT: "#0f172a",
          muted: "#475569",
          faint: "#94a3b8",
        },
        accent: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
        mech: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
        panel: "0 4px 24px -4px rgb(15 23 42 / 0.08)",
        float: "0 12px 40px -8px rgb(15 23 42 / 0.15)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
