import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig({
    plugins: [react()],
    base: './', // Important for Electron to load assets from local file system
    define: {
        '__APP_VERSION__': JSON.stringify(`v${version}`),
    }
});
