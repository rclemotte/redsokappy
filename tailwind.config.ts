import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        marca: {
          DEFAULT: "#2a4d9b",
          dark: "#1e3a78",
        },
      },
    },
  },
  plugins: [],
};

export default config;
