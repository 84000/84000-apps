/* eslint-disable @typescript-eslint/no-explicit-any */
declare module '*.svg' {
  const content: any;
  export const ReactComponent: any;
  export default content;
}

// Side-effect import of the design-system global stylesheet (path alias).
declare module '@eightyfourthousand/design-system/css';
