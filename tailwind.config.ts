import type { Config } from 'tailwindcss';

// Coat Check — Material 3 "warm clay" tokens (defined as CSS vars in globals.css).
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Material 3 warm-clay design tokens (see globals.css :root).
        primary: 'var(--md-primary)',
        'on-primary': 'var(--md-on-primary)',
        'primary-container': 'var(--md-primary-container)',
        'on-primary-container': 'var(--md-on-primary-container)',
        secondary: 'var(--md-secondary)',
        'secondary-container': 'var(--md-secondary-container)',
        'on-secondary-container': 'var(--md-on-secondary-container)',
        surface: 'var(--md-surface)',
        'surface-lowest': 'var(--md-surface-container-lowest)',
        'surface-low': 'var(--md-surface-container-low)',
        'surface-container': 'var(--md-surface-container)',
        'surface-high': 'var(--md-surface-container-high)',
        'surface-highest': 'var(--md-surface-container-highest)',
        'on-surface': 'var(--md-on-surface)',
        'on-surface-variant': 'var(--md-on-surface-variant)',
        outline: 'var(--md-outline)',
        'outline-variant': 'var(--md-outline-variant)',
        'inverse-surface': 'var(--md-inverse-surface)',
        cool: 'var(--cc-cool)',
        'cool-container': 'var(--cc-cool-container)',
        warm: 'var(--cc-warm)',
        'warm-container': 'var(--cc-warm-container)',
        just: 'var(--cc-just-right)',
        'just-container': 'var(--cc-just-right-container)',
        'error-fg': 'var(--md-error)',
        'error-container': 'var(--md-error-container)',
        'on-error-container': 'var(--md-on-error-container)',
      },
      fontFamily: {
        display: ['var(--cc-font)'],
        body: ['var(--cc-font)'],
        sans: ['var(--cc-font)'],
      },
      borderRadius: {
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};

export default config;
