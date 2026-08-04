import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
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
          bg: '#f5f5f7',
          surface: '#ffffff',
          ink: '#1d1d1f',
          secondary: '#6e6e73',
          tertiary: '#86868b',
          line: 'rgba(0, 0, 0, 0.08)',
          blue: '#0071e3',
          'blue-hover': '#0077ed',
          green: '#34c759',
          orange: '#ff9f0a',
          red: '#ff3b30',
          fill: 'rgba(0, 0, 0, 0.04)',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        card: '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
        nav: '0 1px 0 rgba(0,0,0,0.06)',
        float: '0 8px 30px rgba(0,0,0,0.12)',
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
