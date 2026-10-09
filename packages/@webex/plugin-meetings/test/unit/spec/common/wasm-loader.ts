/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WasmLoader from '@webex/plugin-meetings/src/common/wasm-loader';

describe('plugin-meetings', () => {
  describe('WasmLoader', () => {
    const WASM_URL = '/wasm/e2ee.wasm';
    const OTHER_WASM_URL = '/wasm/other.wasm';

    let factory;
    let importModule;
    let moduleInstance;

    beforeEach(() => {
      moduleInstance = {name: 'e2ee-module'};
      factory = sinon.stub().resolves(moduleInstance);
      importModule = sinon.stub().resolves({default: factory});
    });

    afterEach(() => {
      sinon.restore();
    });

    describe('get', () => {
      it('derives the .js loader url from the .wasm url and points locateFile at the .wasm binary', async () => {
        const loader = new WasmLoader({importModule});

        const result = await loader.get(WASM_URL);

        assert.calledOnceWithExactly(importModule, '/wasm/e2ee.js');
        assert.calledOnce(factory);
        const {locateFile} = factory.firstCall.args[0];
        assert.equal(locateFile('e2ee.wasm'), WASM_URL);
        assert.equal(locateFile('e2ee.worker.js'), 'e2ee.worker.js');
        assert.strictEqual(result, moduleInstance);
      });

      it('loads each url only once and returns the cached instance on subsequent calls', async () => {
        const loader = new WasmLoader({importModule});

        const first = await loader.get(WASM_URL);
        const second = await loader.get(WASM_URL);

        assert.calledOnce(importModule);
        assert.calledOnce(factory);
        assert.strictEqual(first, second);
      });

      it('shares a single load across concurrent calls for the same url', async () => {
        const loader = new WasmLoader({importModule});

        const [first, second] = await Promise.all([loader.get(WASM_URL), loader.get(WASM_URL)]);

        assert.calledOnce(importModule);
        assert.strictEqual(first, second);
      });

      it('loads distinct urls independently', async () => {
        const otherInstance = {name: 'other-module'};
        importModule
          .withArgs('/wasm/e2ee.js')
          .resolves({default: factory})
          .withArgs('/wasm/other.js')
          .resolves({default: sinon.stub().resolves(otherInstance)});
        const loader = new WasmLoader({importModule});

        const e2ee = await loader.get(WASM_URL);
        const other = await loader.get(OTHER_WASM_URL);

        assert.calledTwice(importModule);
        assert.calledWith(importModule, '/wasm/e2ee.js');
        assert.calledWith(importModule, '/wasm/other.js');
        assert.strictEqual(e2ee, moduleInstance);
        assert.strictEqual(other, otherInstance);
      });

      it('resets so a failed load can be retried, then rejects', async () => {
        const error = new Error('network down');
        importModule.onFirstCall().rejects(error).onSecondCall().resolves({default: factory});
        const loader = new WasmLoader({importModule});

        await assert.isRejected(loader.get(WASM_URL), /Failed to load WASM module \/wasm\/e2ee\.wasm/);
        assert.isFalse(loader.isLoaded(WASM_URL));

        const result = await loader.get(WASM_URL);

        assert.calledTwice(importModule);
        assert.strictEqual(result, moduleInstance);
      });
    });

    describe('preload', () => {
      it('warms the cache for the given url', async () => {
        const loader = new WasmLoader({importModule});

        await loader.preload(WASM_URL);

        assert.calledOnceWithExactly(importModule, '/wasm/e2ee.js');
        assert.isTrue(loader.isLoaded(WASM_URL));
      });
    });

    describe('isLoaded', () => {
      it('is false for an unknown url', () => {
        const loader = new WasmLoader({importModule});

        assert.isFalse(loader.isLoaded(WASM_URL));
      });

      it('is false while loading is in flight and true once resolved', async () => {
        const loader = new WasmLoader({importModule});

        const pending = loader.get(WASM_URL);

        assert.isFalse(loader.isLoaded(WASM_URL));

        await pending;

        assert.isTrue(loader.isLoaded(WASM_URL));
      });

      it('tracks each url independently', async () => {
        const loader = new WasmLoader({importModule});

        await loader.get(WASM_URL);

        assert.isTrue(loader.isLoaded(WASM_URL));
        assert.isFalse(loader.isLoaded(OTHER_WASM_URL));
      });
    });
  });
});
