/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WasmLoader from '@webex/plugin-meetings/src/e2ee/WasmLoader';

describe('plugin-meetings', () => {
  describe('WasmLoader', () => {
    let fakeModule;
    let factory;
    let importModule;

    beforeEach(() => {
      fakeModule = {WebE2EE: function WebE2EE() {}};
      factory = sinon.stub().resolves(fakeModule);
      importModule = sinon.stub().resolves({default: factory});
    });

    afterEach(() => {
      sinon.restore();
    });

    it('loads and caches the module on get()', async () => {
      const loader = new WasmLoader({importModule});

      assert.isFalse(loader.isLoaded());

      const module = await loader.get();

      assert.equal(module, fakeModule);
      assert.isTrue(loader.isLoaded());
      assert.calledOnceWithExactly(importModule, '/wasm/e2ee.js');
    });

    it('derives the js path and locateFile from wasmUrl', async () => {
      const loader = new WasmLoader({wasmUrl: '/custom/path/e2ee.wasm', importModule});

      await loader.get();

      assert.calledOnceWithExactly(importModule, '/custom/path/e2ee.js');

      const {locateFile} = factory.firstCall.args[0];

      assert.equal(locateFile('anything/e2ee.wasm'), '/custom/path/e2ee.wasm');
      assert.equal(locateFile('anything/e2ee.data'), 'anything/e2ee.data');
    });

    it('only loads once for concurrent and repeated get() calls', async () => {
      const loader = new WasmLoader({importModule});

      const [first, second] = await Promise.all([loader.get(), loader.get()]);
      const third = await loader.get();

      assert.equal(first, fakeModule);
      assert.equal(second, fakeModule);
      assert.equal(third, fakeModule);
      assert.calledOnce(importModule);
    });

    it('preload() warms the cache', async () => {
      const loader = new WasmLoader({importModule});

      await loader.preload();

      assert.isTrue(loader.isLoaded());
      assert.calledOnce(importModule);
    });

    it('rejects and allows a retry when the import fails', async () => {
      const error = new Error('boom');

      importModule.onFirstCall().rejects(error);
      importModule.onSecondCall().resolves({default: factory});

      const loader = new WasmLoader({importModule});

      await assert.isRejected(loader.get(), /Failed to load e2ee WASM module/);
      assert.isFalse(loader.isLoaded());

      const module = await loader.get();

      assert.equal(module, fakeModule);
      assert.isTrue(loader.isLoaded());
      assert.calledTwice(importModule);
    });
  });
});
