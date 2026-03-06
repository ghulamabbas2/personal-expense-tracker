import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^server-only$": "<rootDir>/__mocks__/server-only.ts",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
}

export default config
