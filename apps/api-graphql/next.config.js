import { composePlugins, withNx } from '@nx/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  nx: {},
};

const plugins = [withNx];

export default composePlugins(...plugins)(nextConfig);
