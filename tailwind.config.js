/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0d0d10',
          subtle: '#15151a',
          panel: '#1a1a20',
          elevated: '#22222a',
        },
        border: {
          DEFAULT: '#2a2a33',
          subtle: '#1f1f27',
          strong: '#3a3a45',
        },
        fg: {
          DEFAULT: '#e8e8ec',
          muted: '#9b9ba8',
          subtle: '#6b6b7a',
        },
        accent: {
          DEFAULT: '#a78bfa',
          hover: '#c4b5fd',
          subtle: '#1f1830',
        },
        ok: '#65d99d',
        warn: '#f5b961',
        err: '#f06b6b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
