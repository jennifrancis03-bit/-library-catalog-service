import { defineConfig } from 'vite';

export default defineConfig({
  base: '/admin/',
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/books': 'http://localhost:3000',
      '/genres': 'http://localhost:3000',
      '/login': 'http://localhost:3000',
      '/register': 'http://localhost:3000',
      '/booking': 'http://localhost:3000',
      '/reading-list': 'http://localhost:3000',
    },
  },
});
