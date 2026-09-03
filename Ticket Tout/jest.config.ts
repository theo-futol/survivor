import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  forceExit: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@/lib/prisma/db$': '<rootDir>/tests/mocks/mock-db.ts',
    '^@/lib/services/redis_service$': '<rootDir>/tests/mocks/mock-redis.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'esnext',
        moduleResolution: 'bundler',
        rootDir: '.',
      },
    }],
  },
};

export default config;
