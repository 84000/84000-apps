export default {
  displayName: 'cli',
  preset: '../../jest.preset.js',
  transform: {
    // Pure TypeScript with no JSX and no browser APIs, so tests are compiled
    // for the running Node.
    '^.+\\.[tj]s$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
        ],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/apps/cli',
};
