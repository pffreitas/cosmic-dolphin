/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: true,
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(got|@sindresorhus/is|@szmarczak/http-timer|cacheable-request|cacheable-lookup|responselike|lowercase-keys|p-cancelable|form-data-encoder|p-limit|yocto-queue)/)",
  ],
  moduleNameMapper: {
    "^got$": "<rootDir>/src/__mocks__/got.ts",
  },
  moduleFileExtensions: ["ts", "js", "json"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  testTimeout: 30000, // 30 seconds for database operations
  verbose: true,
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
    "!src/test-utils/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
};
