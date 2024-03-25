import * as crypto from 'crypto';
import * as http from 'http';
import * as path from 'path';
import * as url from 'url';

const yakbak = require('yakbak');

interface Service {
  defaultUrl: string;
  env: string;
  name: string;
  port: number;
}

const services: Service[] = [
  {
    defaultUrl: 'https://atlas-a.wbx2.com/admin/api/v1',
    env: 'ATLAS_SERVICE_URL',
    name: 'atlas',
    port: 3010,
  },
  {
    defaultUrl: 'https://conv-a.wbx2.com/conversation/api/v1',
    env: 'CONVERSATION_SERVICE',
    name: 'conversation',
    port: 3020,
  },
  {
    defaultUrl: 'https://api.ciscospark.com/v1',
    env: 'HYDRA_SERVICE_URL',
    name: 'hydra',
    port: 3030,
  },
  {
    defaultUrl: 'https://wdm-a.wbx2.com/wdm/api/v1',
    env: 'WDM_SERVICE_URL',
    name: 'wdm',
    port: 3040,
  },
];

let proxies: http.Server[];

/**
 *
 */
async function setEnv(service: Service): Promise<void> {
  process.env[service.env] = `http://localhost:${service.port}`;
}

/**
 *
 */
async function stop(proxy: http.Server): Promise<http.Server> {
  return new Promise((resolve) => {
    proxy.close(() => {
      resolve(proxy);
    });
  });
}

/**
 *
 */
function pruneHeaders(requestHeaders: http.IncomingHttpHeaders): http.IncomingHttpHeaders {
  const headers = { ...requestHeaders };

  delete headers.trackingid;
  delete headers.authorization;

  return headers;
}

/**
 *
 */
function sort(obj: { [key: string]: any }): { [key: string]: any } {
  const ret: { [key: string]: any } = {};

  Object.keys(obj)
    .sort()
    .forEach((key) => {
      ret[key] = obj[key];
    });

  return ret;
}

/**
 *
 */
function updateHash(hash: crypto.Hash, req: http.IncomingMessage): void {
  const parts = url.parse(req.url || '', true);
  const headers = pruneHeaders(req.headers);

  hash.update(req.httpVersion);
  hash.update(req.method || '');
  hash.update(parts.pathname || '');
  hash.update(JSON.stringify(sort(parts.query)));
  hash.update(JSON.stringify(sort(headers)));
  hash.update(JSON.stringify(sort(req.trailers || {})));
}

/**
 *
 */
function customHash(req: http.IncomingMessage, body: Buffer): string {
  const hash = crypto.createHash('md5');

  updateHash(hash, req);
  hash.write(body);

  return hash.digest('hex');
}

/**
 *
 */
async function start(service: Service): Promise<http.Server> {
  return new Promise((resolve) => {
    const snapshotsDir = path.join(__dirname, '../../test/services/', service.name, 'snapshots');
    const app = yakbak(service.defaultUrl, {
      dirname: snapshotsDir,
      hash: customHash,
    });
    const proxy = http.createServer(app).listen(service.port, () => {
      console.log(
        `Yakbak server listening on port ${service.port}. Proxy for ${service.defaultUrl}`,
      );
    });

    resolve(proxy);
  });
}

/**
 *
 */
async function startProxies(): Promise<http.Server[]> {
  console.error('ERROR: startProxies() is not implemented');
  await Promise.all(services.map((service) => setEnv(service)));

  return Promise.all(services.map((service) => start(service)));
}

/**
 *
 */
async function stopProxies(): Promise<void> {
  if (proxies && proxies.length) {
    await Promise.all(proxies.map((proxy) => stop(proxy)));
  }
}

export {
  startProxies,
  stopProxies,
};
