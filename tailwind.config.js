/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Afacad Flux"', 'sans-serif'],
      },
      colors: {
        nexus: {
          bg: '#002B54',      // Azul Marinho institucional (estilo Prefeitura de Joinville)
          card: '#ffffff',    // Fundo branco pros blocos e cards
          primary: '#0284c7', // Azul principal para botões/logos
          text: '#334155',    // Texto escuro suave para dentro dos cards
          border: '#e2e8f0',  // Bordas discretas
        }
      }
    },
  },
  plugins: [],
}