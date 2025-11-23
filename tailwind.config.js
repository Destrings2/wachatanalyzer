/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    // MetricCard color classes
    'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50',
    'dark:bg-blue-900/20', 'dark:bg-green-900/20', 'dark:bg-purple-900/20', 'dark:bg-orange-900/20',
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600',
    'dark:text-blue-400', 'dark:text-green-400', 'dark:text-purple-400', 'dark:text-orange-400',
    'text-blue-900', 'text-green-900', 'text-purple-900', 'text-orange-900',
    'dark:text-blue-100', 'dark:text-green-100', 'dark:text-purple-100', 'dark:text-orange-100',
    // Emoji sentiment colors
    'bg-red-500', 'bg-green-500', 'bg-gray-500',
    'text-red-600', 'text-gray-600',
    'dark:text-red-400', 'dark:text-gray-400',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        // Custom primary gradient colors
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1', // Violet
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        secondary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef', // Fuchsia
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        // Dark mode background colors
        cosmic: {
          900: '#0f172a',
          950: '#020617',
        }
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          'from': { boxShadow: '0 0 10px -10px #6366f1' },
          'to': { boxShadow: '0 0 20px 5px #6366f1' },
        }
      },
      // Enhanced breakpoints for better mobile-first design
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      // Mobile-friendly spacing
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      // Touch-friendly sizing
      minHeight: {
        'touch': '44px', // Minimum touch target size
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}
