export default {
  displayName: 'data-access',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: ['@nx/react/babel'],
        // `@nx/react/babel` leaves ESM alone, so an ESM-only dependency reaches
        // Jest as `import` and fails to parse. Un-ignoring it in the preset is
        // only half the job; this is the half that converts it.
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/data-access',
};
