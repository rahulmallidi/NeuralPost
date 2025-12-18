// Set NODE_ENV before any modules are loaded so workers/limiters skip correctly
process.env.NODE_ENV = 'test';

/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},          // no transpilation — native ESM passthrough
  testMatch: ['**/src/__tests__/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,        // closes DB pool / Redis handles automatically
};
