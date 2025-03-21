module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts', '**/*.test.ts'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.enum.ts'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1'
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  // Temporarily commenting out SonarQube reporter to run tests
  // reporters: [
  //   'default',
  //   ['jest-sonar-reporter', { outputDirectory: 'coverage', outputName: 'sonar-report.xml' }]
  // ]
}
