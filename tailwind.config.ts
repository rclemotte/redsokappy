import type { Config } from "tailwindcss";

// Paleta inspirada en el arte del Festival Soka por la Paz:
// rosa intenso, naranja sol y amarillo, sobre fondos cálidos y claros.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Color principal (antes azul). Todo lo que usa bg-marca / text-marca toma el rosa.
        marca: {
          DEFAULT: "#DB1470",
          dark: "#B00D5A",
          50: "#FFF0F6",
          100: "#FFE0EC",
          200: "#FFC2DA",
        },
        sol: {
          rosa: "#F11579",
          naranja: "#FF4A0A",
          amarillo: "#FFB127",
        },
        tinta: {
          DEFAULT: "#2B1433",
          suave: "#6E5A72",
          tenue: "#A595A8",
        },
        crema: "#FFF7F3",
        linea: "#F3E3EA",
        estado: {
          activo: "#12945F",
          activoBg: "#E2F6EC",
          inactivo: "#7D7083",
          inactivoBg: "#F0ECF1",
          amigo: "#E2540E",
          amigoBg: "#FFEADF",
          nuevo: "#B97800",
          nuevoBg: "#FFF3D6",
        },
      },
      fontFamily: {
        display: ['"Baloo 2"', "system-ui", "sans-serif"],
        sans: ["Nunito", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        suave: "0 1px 2px rgba(43,20,51,0.04), 0 6px 20px -8px rgba(219,20,112,0.18)",
        flotante: "0 10px 30px -10px rgba(43,20,51,0.35)",
      },
      backgroundImage: {
        sol: "linear-gradient(135deg, #F11579 0%, #FF4A0A 100%)",
        "sol-suave": "linear-gradient(135deg, #FFE3EF 0%, #FFE9DC 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
