import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bybit: {
          bg: '#090A0F',
          surface: '#12161C',
          elevated: '#1A1F29',
          yellow: '#F7A600',
          yellowHover: '#FFB100',
          border: 'rgba(247, 166, 0, 0.2)',
        },
        uzu: {
          950: '#090A0F',
          900: '#12161C',
          800: '#1A1F29',
          700: '#2A2F3A',
          600: '#3D3D48',
          yellow: '#F7A600',
          'yellow-light': '#FFB100',
          'yellow-dark': '#D48B00',
          emerald: '#00C853',
          danger: '#FF3D00',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'bybit-glow': '0 0 25px rgba(247, 166, 0, 0.25)',
        'card-hover': '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(247, 166, 0, 0.15)',
      },
      backdropBlur: {
        glass: '16px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'grid-flow': 'gridFlow 20s linear infinite',
        'orbit': 'orbit 12s linear infinite',
        'orbit-reverse': 'orbit 15s linear infinite reverse',
        'progress': 'progress 2.5s ease-in-out forwards',
              'bounce': 'bounce 1s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(247, 166, 0, 0.1)' },
          '100%': { boxShadow: '0 0 40px rgba(247, 166, 0, 0.3)' },
        },
        gridFlow: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-100%)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        progress: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
                bounce: {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.15)' },
                },
      },
    },
  },
  plugins: [],
};

export default config;