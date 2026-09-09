import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

export default defineConfig({
    plugins: [react()],
    base: './', // Important for Electron to load assets from local file system
    server: {
        watch: { ignored: ['**/dist_electron*/**', '**/output/**'] },
    },
    define: {
        '__APP_VERSION__': JSON.stringify(`v${version}`),
    }
});
