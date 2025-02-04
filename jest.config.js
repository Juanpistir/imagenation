export default {
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {},
  testTimeout: 180000,
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  verbose: true,
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@fastify|firebase|cloudinary)/)'
  ],
  moduleDirectories: ['node_modules', 'src'],
  resolver: undefined,
  testPathIgnorePatterns: ['/node_modules/'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
} 