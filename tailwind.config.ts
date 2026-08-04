import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          'system-ui',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        apple: {
          bg: 'rgb(var(--apple-bg) / <alpha-value>)',
          surface: 'rgb(var(--apple-surface) / <alpha-value>)',
          ink: 'rgb(var(--apple-ink) / <alpha-value>)',
          secondary: 'rgb(var(--apple-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--apple-tertiary) / <alpha-value>)',
          line: 'var(--apple-line)',
          blue: 'rgb(var(--apple-blue) / <alpha-value>)',
          'blue-hover': 'rgb(var(--apple-blue-hover) / <alpha-value>)',
          green: 'rgb(var(--apple-green) / <alpha-value>)',
          orange: 'rgb(var(--apple-orange) / <alpha-value>)',
          red: 'rgb(var(--apple-red) / <alpha-value>)',
          fill: 'var(--apple-fill)',
        },
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        nav: 'var(--shadow-nav)',
        float: 'var(--shadow-float)',
      },
      borderRadius: {
        apple: '12px',
        'apple-lg': '18px',
        'apple-xl': '22px',
      },
      letterSpacing: {
        tightish: '-0.022em',
      },
    },
  },
  plugins: [],
};

export default config;
