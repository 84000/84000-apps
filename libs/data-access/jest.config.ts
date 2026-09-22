// `sanitize-html`'s parser is ESM only. The shared preset un-ignores it; this is
// the other half, because `@nx/react/babel` leaves `import` alone. Only this
// project has needed it so far -- the others that load the sanitizer transitively
// convert it without help.
export default {
  displayName: 'data-access',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      {
        presets: ['@nx/react/babel'],
        // Un-ignoring is only half the job: `@nx/react/babel` leaves `import`
        // alone, and this is the half that converts it.
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/data-access',
};
