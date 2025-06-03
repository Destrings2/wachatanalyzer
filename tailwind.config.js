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
      animation: {
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce': 'bounce 1s infinite',
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
