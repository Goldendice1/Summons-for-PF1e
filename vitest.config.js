import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['./tests/setup.js'],
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'v8',
            include: ['scripts/**/*.js'],
            reporter: ['text', 'json-summary'],
        },
    }
});
