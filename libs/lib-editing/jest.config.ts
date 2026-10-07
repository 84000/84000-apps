// `marked` (beneath @tiptap/markdown) ships only as ESM, so it is transformed
// like the shared preset's ESM dependencies. Kept to this project: it is the
// only one that loads the markdown codec.
const esmDeps = ['uuid', 'sanitize-html', 'marked'];

export default {
  displayName: 'lib-editing',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': ['babel-jest', { presets: ['@nx/react/babel'] }],
  },
  // Same shape as the preset's pattern; see jest.preset.js for why.
  transformIgnorePatterns: [
    `^(?:(?!/node_modules/).)*/node_modules/(?!(?:.*/)?(?:${esmDeps.join('|')})/)`,
    '\\.pnp\\.[^\\/]+$',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/libs/lib-editing',
};
