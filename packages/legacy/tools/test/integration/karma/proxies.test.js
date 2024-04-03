const { stopProxies, startProxies } = require('@webex/legacy-tools');

describe('Proxy Server Integration Tests', () => {
  let proxies;

  beforeAll(async () => {
    proxies = await startProxies();
  });

  afterAll(async () => {
    await stopProxies();
  });

  it('should have started all the proxy servers', () => {
    expect(Array.isArray(proxies)).toBe(true);
    expect(proxies.length).toBeGreaterThanOrEqual(1);
    proxies.forEach((proxy) => {
      expect(typeof proxy).toBe('object');
      expect(proxy.listening).toBe(true);
    });
  });

  it('should correctly set environment variables for services', () => {
    expect(process.env.ATLAS_SERVICE_URL).toBe('http://localhost:3010');
    expect(process.env.CONVERSATION_SERVICE).toBe('http://localhost:3020');
    expect(process.env.HYDRA_SERVICE_URL).toBe('http://localhost:3030');
    expect(process.env.WDM_SERVICE_URL).toBe('http://localhost:3040');
  });

  it('should correctly stop all proxy servers', async () => {
    await stopProxies();

    proxies.forEach((proxy) => {
      expect(proxy.listening).toBe(false);
    });
  });
});
