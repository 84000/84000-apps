export default {
  displayName: 'lib-persistence',
  preset: '../../jest.preset.js',
  transform: {
    // This library has no JSX, and its tests drive node:sqlite, so they are
    // compiled for the running Node rather than for browsers. Targeting Node
    // keeps `#private` methods native — the shared `@nx/react/babel` preset
    // downlevels them and then conflicts over Babel's `loose` mode. Browser
    // builds go through Turbopack and are unaffected by this.
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironment: 'node',
  // Decides synchronously, before `describe` runs, whether a local Supabase
  // stack is reachable — so the DEV-707 convergence suite can report as
  // *skipped* rather than as eleven passing tests that asserted nothing.
  globalSetup: '<rootDir>/src/lib/sync/testing/global-setup.ts',
  coverageDirectory: '../../coverage/libs/lib-persistence',
};
