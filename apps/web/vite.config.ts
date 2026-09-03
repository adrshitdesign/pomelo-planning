import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const API_TARGET = process.env.VITE_API_URL ?? 'http://localhost:3000';

// Sur GitHub Pages, le site est servi depuis /<nom-du-depot>/ et non à la
// racine du domaine. La variable est posée par le workflow de déploiement.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Écoute sur toutes les interfaces : nécessaire en conteneur (Codespaces, Docker).
    host: true,
    // Vite bloque par défaut les noms de domaine inconnus. On autorise
    // explicitement les environnements de développement en ligne.
    allowedHosts: [
      'localhost',
      '.app.github.dev', // GitHub Codespaces
      '.github.dev',
      '.gitpod.io',
      '.repl.co',
    ],
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: ['localhost', '.app.github.dev', '.github.dev'],
  },
});
