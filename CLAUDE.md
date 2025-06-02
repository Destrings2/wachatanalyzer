# Project Context for Claude

This is a React application meant to run client side, there is no Node.JS

## Tailwind CSS Quirks

### Dynamic Class Generation Issue
When using template literals for Tailwind classes (e.g., `bg-${color}-50`), Tailwind's purge process may remove unused color variants from the final CSS bundle. This happens because Tailwind can't detect dynamically generated class names during build time.

**Solution**: Add a `safelist` array to `tailwind.config.js` to ensure specific color classes are always included:

```javascript
export default {
  safelist: [
    // MetricCard color classes
    'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50',
    'dark:bg-blue-900/20', 'dark:bg-green-900/20', 'dark:bg-purple-900/20', 'dark:bg-orange-900/20',
    'text-blue-600', 'text-green-600', 'text-purple-600', 'text-orange-600',
    'dark:text-blue-400', 'dark:text-green-400', 'dark:text-purple-400', 'dark:text-orange-400',
    'text-blue-900', 'text-green-900', 'text-purple-900', 'text-orange-900',
    'dark:text-blue-100', 'dark:text-green-100', 'dark:text-purple-100', 'dark:text-orange-100',
  ],
  // ... rest of config
}
```

This ensures components like `MetricCard` that use dynamic color props work consistently across all color variants.
