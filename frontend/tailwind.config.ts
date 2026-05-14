import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d7fe',
          300: '#a5bcfc',
          400: '#8098f9',
          500: '#5e72f5',
          600: '#4550e9',
          700: '#3840d4',
          800: '#2f34ab',
          900: '#2d3288',
          950: '#1b1e54',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger:  '#dc2626',
        neutral: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontSize: {
        // 고령층 친화 — 기본 16px 이상
        'display': ['3rem', { lineHeight: '1.1', fontWeight: '700' }],
        'heading1': ['2rem',   { lineHeight: '1.2', fontWeight: '700' }],
        'heading2': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading3': ['1.25rem',{ lineHeight: '1.4', fontWeight: '600' }],
        'body':     ['1rem',   { lineHeight: '1.6' }],
        'body-lg':  ['1.125rem',{ lineHeight: '1.6' }],
        'caption':  ['0.875rem',{ lineHeight: '1.5' }],
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-lg': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}

export default config
