import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: '#F54E00',
          50: '#FFF1EC',
          100: '#FFE3D9',
          200: '#FFC7B3',
          300: '#FFAA8D',
          400: '#FF8E67',
          500: '#F54E00',
          600: '#CC4100',
          700: '#A33400',
          800: '#7A2700',
          900: '#521A00',
        },
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gray.800'),
            a: {
              color: theme('colors.brand.500'),
              '&:hover': { color: theme('colors.brand.600') },
              textDecoration: 'underline',
            },
            'h1, h2, h3, h4': {
              fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
              fontWeight: '700',
              scrollMarginTop: '5rem',
            },
            code: {
              fontFamily: '"IBM Plex Mono", monospace',
              backgroundColor: theme('colors.gray.100'),
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '400',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
        invert: {
          css: {
            color: theme('colors.gray.200'),
            a: {
              color: theme('colors.brand.400'),
              '&:hover': { color: theme('colors.brand.300') },
            },
            code: {
              backgroundColor: theme('colors.gray.800'),
            },
          },
        },
      }),
    },
  },
  plugins: [typography],
};
