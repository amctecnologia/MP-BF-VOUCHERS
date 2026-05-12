export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:    { DEFAULT: '#2D2D2D', light: '#444444' },
        accent:     { DEFAULT: '#A02030', light: '#C0303F', dark: '#7A1525' },
        surface:    '#F5F5F5',
      },
    },
  },
  plugins: [],
};
