export default {
  displayName: 'lib-doc-model',
  preset: '../../jest.preset.js',
  transform: {
    // No JSX and no browser APIs anywhere in this library, so its tests are
    // compiled for the running Node rather than for browsers. The React
    // preset is still needed: `@eightyfourthousand/data-access` is compiled
    // from source and its barrel reaches `.tsx` files.
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          '@babel/preset-typescript',
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testEnvironment: 'node',
  coverageDirectory: '../../coverage/libs/lib-doc-model',
};
