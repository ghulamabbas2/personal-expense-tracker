# Unit Test Writer — Persistent Memory

## Project: personal-expense-tracker

### Test runner setup
- Jest 29 + ts-jest 29; config in `jest.config.ts` (requires `ts-node` as a devDependency)
- `testMatch`: `**/__tests__/**/*.test.ts` (no `.tsx` — node environment only)
- `moduleNameMapper`: `^@/(.*)$` → `<rootDir>/$1`; `^server-only$` → `<rootDir>/__mocks__/server-only.ts`
- `clearMocks: true` — mocks are cleared automatically between tests (return values must be re-set in `beforeEach` when needed across test groups)
- Run with: `npm test`

### Key source file locations
- Zod schemas: `lib/schemas/auth.ts` — exports `signInSchema`, `signUpSchema`, `SignInInput`, `SignUpInput`
- NextAuth config: `lib/auth.ts` — exports `authOptions`; imports `server-only` (mocked via moduleNameMapper)
- Sign-up server action: `app/(auth)/sign-up/actions.ts` — exports `registerUser(data: unknown)`
- Middleware: `middleware.ts` — exports default (wrapped fn) and named `config`

### Established mocking patterns
- `next-auth`: `jest.fn(() => jest.fn())`
- `next-auth/providers/credentials`: `jest.fn((config) => ({ ...config, id: 'credentials', type: 'credentials' }))` — this makes `authOptions.providers[0].authorize` directly accessible
- `@next-auth/mongodb-adapter`: `{ MongoDBAdapter: jest.fn(() => ({})) }`
- `@/lib/mongodb-client`: `Promise.resolve({})`
- `@/lib/db`: `{ connectDB: jest.fn().mockResolvedValue(undefined) }`
- `@/lib/models/user`: `{ __esModule: true, default: { findOne: jest.fn(), create: jest.fn() } }`
- `bcryptjs`: `{ hash: jest.fn(), compare: jest.fn() }`
- `next-auth/middleware`: capture `capturedMiddlewareFn` and `capturedOpts` inside `withAuth` mock — import middleware module after mock setup so `withAuth` is called with the spy in place
- `next/server`: `{ NextResponse: { redirect: jest.fn((url) => ({ type: 'redirect', url })) } }`

### Common edge cases found in auth logic
- `authorize` lowercases email before querying: always test `findOne` was called with lowercased email
- `registerUser` lowercases email on both `findOne` and `User.create`
- `session` callback whitelists exactly `{ id, name, email }` — test `Object.keys(result.user).length === 3`
- `jwt` callback only sets `token.sub` when `user` object is present (first sign-in); passes through otherwise

### Matcher regex pitfall
- The Next.js config.matcher pattern `/((?!sign-in|sign-up|...).*)/` uses a negative lookahead
- Do NOT test this pattern as a plain JS RegExp against route strings — the lookahead only works correctly inside the Next.js routing engine, not via `new RegExp(pattern).test(path)`
- Instead: verify each exclusion keyword is present in the pattern string with `toContain`

### console.error in tests
- `registerUser` calls `console.error` in its catch block; tests that trigger the catch path will print to the console — this is expected behavior, not a test failure

### ts-node requirement
- `jest.config.ts` is a TypeScript file; Jest requires `ts-node` installed as a devDependency to parse it
- See: `docs/errors-and-validation.md` for error shape; `docs/auth.md` for auth patterns
