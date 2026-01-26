export const healthQueries = {
  health: () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }),

  version: () => '1.0.0',
};
