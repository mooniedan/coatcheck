import type { Config } from 'tailwindcss';

// Coat Check palette — cool sky tones for weather, warm accents for clothing.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#11202b', 2: '#1d3340', 3: '#2c4654' },
        paper: { DEFAULT: '#f5f8fb', 2: '#e6eef5', 3: '#d2e0eb' },
        sky: { DEFAULT: '#3aa0e8', deep: '#1f6fb0' },
        dusk: { DEFAULT: '#5b6ea8', deep: '#3c4a78' },
        warmth: { DEFAULT: '#f5a623', deep: '#d2860a' },
        chill: { DEFAULT: '#7ec8e3', deep: '#4f9fc0' },
      },
      fontFamily: {
        display: ['"Poppins"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
