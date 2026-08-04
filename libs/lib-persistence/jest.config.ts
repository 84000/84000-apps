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
  coverageDirectory: '../../coverage/libs/lib-persistence',
};
