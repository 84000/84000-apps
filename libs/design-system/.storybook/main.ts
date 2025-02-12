import type { StorybookConfig } from '@storybook/nextjs';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
  webpackFinal: async (config) => {
    if (!config.module?.rules) {
      config.module = { rules: [] };
    }

    if (!config.module.rules) {
      config.module.rules = [];
    }

    // Remove any existing CSS rules
    config.module.rules = config.module.rules.filter(
      (rule) => rule?.test?.toString() !== '/\\.css$/'
    );

    config.module.rules.push({
      test: /\.css$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
          },
        },
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions: {
              plugins: ['tailwindcss', 'autoprefixer'],
            },
          },
        },
      ],
      include: [path.resolve(__dirname, '../src')],
    });

    return config;
  },
};

export default config;
