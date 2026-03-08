// Jest mock for the `server-only` package.
// In production, importing `server-only` throws if the module is bundled into
// a client bundle. In the test environment we just need a no-op so test files
// can import server-side modules without errors.
export {}
