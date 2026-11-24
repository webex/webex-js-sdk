/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import http from 'http';
import {EventEmitter} from 'events';
import {assert} from '@webex/test-helper-chai';

import nodeRequest from '@webex/http-core/src/request/request';

describe('request (node transport)', () => {
  let server;
  let base;
  const seen = [];

  const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary');

  const send = (options) =>
    nodeRequest(
      Object.assign(
        {headers: {}, logger: {warn: () => {}}, download: new EventEmitter(), upload: new EventEmitter()},
        options
      )
    );

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks = [];

      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        seen.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        });

        if (req.url === '/json') {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({isObject: true}));
        } else if (req.url === '/binary') {
          res.setHeader('content-length', gif.length);
          res.end(gif);
        } else if (req.url === '/cookie') {
          res.setHeader('set-cookie', 'session=abc; Path=/');
          res.end('ok');
        } else if (req.url === '/missing') {
          res.statusCode = 404;
          res.end('nope');
        } else {
          res.end('echo');
        }
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    seen.length = 0;
  });

  it('parses JSON, attaches the options and reports download progress', async () => {
    const options = {uri: `${base}/json`, method: 'GET', json: true, download: new EventEmitter()};
    const progress = [];

    options.download.on('progress', (event) => progress.push(event));

    const res = await send(options);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {isObject: true});
    assert.equal(res.options.uri, options.uri);
    assert.isAbove(progress.length, 0);
  });

  it('sends form payloads with basic auth', async () => {
    const res = await send({
      uri: `${base}/echo`,
      method: 'POST',
      form: {grant_type: 'code', code: 'a b'},
      auth: {user: 'client', pass: 'secret', sendImmediately: true},
    });

    assert.equal(res.statusCode, 200);
    assert.equal(seen[0].method, 'POST');
    assert.equal(seen[0].body, 'grant_type=code&code=a%20b');
    assert.equal(seen[0].headers.authorization, `Basic ${Buffer.from('client:secret').toString('base64')}`);
  });

  it('returns detected binary bodies as buffers', async () => {
    const res = await send({uri: `${base}/binary`, method: 'GET', responseType: 'buffer'});

    assert.isTrue(Buffer.isBuffer(res.body));
    assert.equal(res.body.type, 'image/gif');
  });

  it('detects the content type of a buffer request body', async () => {
    await send({
      uri: `${base}/echo`,
      method: 'PUT',
      body: gif,
    });

    assert.equal(seen[0].headers['content-type'], 'image/gif');
  });

  it('resolves HTTP error statuses instead of rejecting', async () => {
    const res = await send({uri: `${base}/missing`, method: 'GET'});

    assert.equal(res.statusCode, 404);
    assert.equal(res.body, 'nope');
  });

  it('keeps cookies only when credentials are requested', async () => {
    await send({uri: `${base}/cookie`, method: 'GET', withCredentials: true});
    await send({uri: `${base}/echo`, method: 'GET', withCredentials: true});
    await send({uri: `${base}/echo`, method: 'GET'});

    assert.equal(seen[1].headers.cookie, 'session=abc');
    assert.isUndefined(seen[2].headers.cookie);
  });

  it('resolves a network failure as a status 0 response', async () => {
    const closed = http.createServer();

    await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const {port} = closed.address();

    await new Promise((resolve) => closed.close(resolve));

    const res = await send({uri: `http://127.0.0.1:${port}/`, method: 'GET'});

    assert.equal(res.statusCode, 0);
    assert.equal(res.body.code, 'ECONNREFUSED');
  });
});
