export const process = {
  env: new Proxy({}, {
    get: () => '',
  })
};
