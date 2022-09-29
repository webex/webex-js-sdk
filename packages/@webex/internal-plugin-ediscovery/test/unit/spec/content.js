import EDiscovery from '@webex/internal-plugin-ediscovery';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {assert, expect} from '@webex/test-helper-chai';
import config from '@webex/internal-plugin-ediscovery/src/config';

/* eslint-disable max-len */
describe('EDiscovery Content API Tests', () => {
  let webex;
  const uuid = 'cc06f622-46ab-45b9-b3a6-5d70bad1d70a';
  const url = 'https://ediscovery-intb.wbx2.com/ediscovery/api/v1/reports/cc06f622-46ab-45b9-b3a6-5d70bad1d70a';
  const invalidUrl = 'https://ediscovery-intb.wbx2.com/ediscovery/api/v1/reports/';
  const defaultTimeout = 30000;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        ediscovery: EDiscovery
      }
    });
    webex.config.ediscovery = config.ediscovery;
  });

  describe('GetContent Tests', () => {
    it('GetContent succeeds', async () => {
      const result = webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1})
        .then((res) => {
          expect(res.statusCode).equal(200);
        });

      return result;
    });

    it('GetContent fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContent()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContent timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContent(uuid)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContent timeout defaults to 30s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContent timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContent(uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContent timeout can be overwritten to 5s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
          sinon.assert.calledWith(webex.request, sinon.match.has('qs', {offset: 0, size: 1}));
        });

      return result;
    });

    it('GetContent makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1, timeoutMs: 5000});
      webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1, timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContent makes multiple requests when called multiple times with different params', async () => {
      webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 1, timeoutMs: 5000});
      webex.internal.ediscovery.getContent(uuid, {offset: 1, size: 1, timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContent(uuid, {offset: 0, size: 2, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });
  });

  describe('GetContent by url Tests', () => {
    it('GetContent by url succeeds', async () => {
      const result = webex.internal.ediscovery.getContent(url, {offset: 0, size: 1})
        .then((res) => {
          expect(res.statusCode).equal(200);
        });

      return result;
    });

    it('GetContent by url fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContent()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContent by url fails with a url that does not contain a report id', async () => {
      const result = expect(webex.internal.ediscovery.getContent(invalidUrl)).to.be.rejectedWith(Error, 'Report url does not contain a report id');

      return result;
    });

    it('GetContent by url timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContent(url)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContent by url timeout defaults to 30s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContent(url, {offset: 0, size: 1})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContent by url timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContent(url, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContent by url timeout can be overwritten to 5s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContent(url, {offset: 0, size: 1, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
          sinon.assert.calledWith(webex.request, sinon.match.has('qs', {offset: 0, size: 1}));
        });

      return result;
    });

    it('GetContent by url makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContent(url, {offset: 0, size: 1, timeoutMs: 5000});
      webex.internal.ediscovery.getContent(url, {offset: 0, size: 1, timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContent(url, {offset: 0, size: 1, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContent by url makes multiple requests when called multiple times with different params', async () => {
      webex.internal.ediscovery.getContent(url, {offset: 0, size: 1, timeoutMs: 5000});
      webex.internal.ediscovery.getContent(url, {offset: 1, size: 1, timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContent(url, {offset: 0, size: 2, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });
  });

  describe('GetContentContainer Tests', () => {
    it('GetContentContainer succeeds', async () => {
      const result = webex.internal.ediscovery.getContentContainer(uuid, {offset: 0, size: 1})
        .then((res) => {
          expect(res.statusCode).equal(200);
        });

      return result;
    });

    it('GetContentContainer fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainer()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContentContainer timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContentContainer(uuid)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainer timeout defaults to 30s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContentContainer(uuid, {offset: 0, size: 1})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainer timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContentContainer(uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContentContainer timeout can be overwritten to 5s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      })
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
          sinon.assert.calledWith(webex.request, sinon.match.has('types', []));
          sinon.assert.calledWith(webex.request, sinon.match.has('qs', {offset: 0, size: 1}));
        });

      return result;
    });

    it('GetContentContainer makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      });
      webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      });
      const result = webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      })
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContentContainer makes multiple requests when called multiple times with different params', async () => {
      webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: ['MEETING']
      });
      webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: ['SPACE']
      });
      const result = webex.internal.ediscovery.getContentContainer(uuid, {
        offset: 0, size: 1, timeoutMs: 5000, types: undefined
      })
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });

    it('GetContentContainer sets report in contentContainerCache if it does not exist', async () => {
      const mockResponse = {body: [{containerId: uuid}]};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      webex.internal.ediscovery.contentContainerCache = {
        set: sinon.stub(),
        has: sinon.stub().returns(false),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(uuid, {offset: 0, size: 1})
        .then(() => {
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.has, uuid);
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.set, uuid, new Map());
        });

      return result;
    });

    it('GetContentContainer does not retrieve container from contentContainerCache if available', async () => {
      const mockCachedContainer = {containerId: uuid};
      const containerIdMap = {
        get: sinon.stub().withArgs(uuid).returns(mockCachedContainer),
        set: sinon.stub(),
        has: sinon.stub().returns(true)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(uuid, {offset: 0, size: 1})
        .then((res) => {
          expect(res).to.not.equal(mockCachedContainer);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 0);
          assert.callCount(containerIdMap.has, 0);
          assert.callCount(containerIdMap.get, 0);
        });

      return result;
    });

    it('GetContentContainer populates contentContainerCache with container when retrieved', async () => {
      const mockResponse = {body: [{containerId: uuid}]};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(uuid, {offset: 0, size: 1})
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 1);
          assert.calledWith(containerIdMap.set, mockResponse.body[0].containerId, mockResponse.body[0]);
        });

      return result;
    });
  });

  describe('GetContentContainer by url Tests', () => {
    it('GetContentContainer succeeds', async () => {
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1})
        .then((res) => {
          expect(res.statusCode).equal(200);
        });

      return result;
    });

    it('GetContentContainer by url fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainer()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContentContainer by url fails with a url that does not contain a report id', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainer(invalidUrl)).to.be.rejectedWith(Error, 'Report url does not contain a report id');

      return result;
    });

    it('GetContentContainer by url timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContentContainer(url)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainer by url timeout defaults to 30s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainer by url timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContentContainer(url, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContentContainer by url timeout can be overwritten to 5s when other options are specified', async () => {
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1, timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
          sinon.assert.calledWith(webex.request, sinon.match.has('qs', {offset: 0, size: 1}));
        });

      return result;
    });

    it('GetContentContainer by url makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      });
      webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      });
      const result = webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: []
      })
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContentContainer by url makes multiple requests when called multiple times with different types', async () => {
      webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: ['MEETING']
      });
      webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: ['SPACE']
      });
      const result = webex.internal.ediscovery.getContentContainer(url, {
        offset: 0, size: 1, timeoutMs: 5000, types: undefined
      })
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });

    it('GetContentContainer by url sets report in contentContainerCache if it does not exist', async () => {
      const mockResponse = {body: [{containerId: uuid}]};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      webex.internal.ediscovery.contentContainerCache = {
        set: sinon.stub(),
        has: sinon.stub().returns(false),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1})
        .then(() => {
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.has, uuid);
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.set, uuid, new Map());
        });

      return result;
    });

    it('GetContentContainer by url does not retrieve container from contentContainerCache if available', async () => {
      const mockCachedContainer = {containerId: uuid};
      const containerIdMap = {
        get: sinon.stub().withArgs(uuid).returns(mockCachedContainer),
        set: sinon.stub(),
        has: sinon.stub().returns(true)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1})
        .then((res) => {
          expect(res).to.not.equal(mockCachedContainer);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 0);
          assert.callCount(containerIdMap.has, 0);
          assert.callCount(containerIdMap.get, 0);
        });

      return result;
    });

    it('GetContentContainer by url populates contentContainerCache with container when retrieved', async () => {
      const mockResponse = {body: [{containerId: uuid}]};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainer(url, {offset: 0, size: 1})
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 1);
          assert.calledWith(containerIdMap.set, mockResponse.body[0].containerId, mockResponse.body[0]);
        });

      return result;
    });
  });

  describe('GetContentContainerByContainerId Tests', () => {
    it('GetContentContainerByContainerId succeeds', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then((res) => {
          expect(res).to.not.equal(undefined);
        });

      return result;
    });

    it('GetContentContainerByContainerId fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainerByContainerId()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContentContainerByContainerId timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainerByContainerId timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContentContainerByContainerId makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid, {timeoutMs: 5000});
      webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid, {timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContentContainerByContainerId makes multiple requests when called multiple times with different params', async () => {
      webex.internal.ediscovery.getContentContainerByContainerId(uuid, '0d4084ce-8cef-43fd-9313-fb64579996ba', {timeoutMs: 5000});
      webex.internal.ediscovery.getContentContainerByContainerId(uuid, '089fcf55-3f38-4763-a441-b1c3540404cf', {timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });

    it('GetContentContainerByContainerId sets report in contentContainerCache if it does not exist', async () => {
      const mockResponse = {body: {containerId: uuid}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      webex.internal.ediscovery.contentContainerCache = {
        set: sinon.stub(),
        has: sinon.stub().returns(false),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then(() => {
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.has, uuid);
          assert.calledWith(webex.internal.ediscovery.contentContainerCache.set, uuid, new Map());
        });

      return result;
    });

    it('GetContentContainerByContainerId retrieves container from contentContainerCache if available', async () => {
      const mockCachedContainer = {containerId: uuid};

      const containerIdMap = {
        get: sinon.stub().withArgs(uuid).returns(mockCachedContainer),
        set: sinon.stub(),
        has: sinon.stub().returns(true)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then((res) => {
          expect(res.body).to.equal(mockCachedContainer);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 1);
          assert.callCount(containerIdMap.has, 1);
          assert.callCount(containerIdMap.get, 1);
        });

      return result;
    });

    it('GetContentContainerByContainerId populates contentContainerCache with container when retrieved', async () => {
      const mockResponse = {body: {containerId: uuid}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 2);
          assert.callCount(containerIdMap.has, 1);
          assert.calledWith(containerIdMap.set, mockResponse.body.containerId, mockResponse.body);
        });

      return result;
    });

    it('GetContentContainerByContainerId cannot write container to contentContainerCache without containerId', async () => {
      const mockResponse = {body: {}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(uuid, uuid)
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 2);
          assert.callCount(containerIdMap.has, 1);
          assert.notCalled(containerIdMap.set);
        });

      return result;
    });
  });

  describe('GetContentContainerByContainerId by url Tests', () => {
    it('GetContentContainerByContainerId by url succeeds', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid)
        .then((res) => {
          expect(res).to.not.equal(undefined);
        });

      return result;
    });

    it('GetContentContainerByContainerId by url fails with no params', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainerByContainerId()).to.be.rejectedWith(Error, 'Undefined parameter');

      return result;
    });

    it('GetContentContainerByContainerId by url fails with a url that does not contain a report id', async () => {
      const result = expect(webex.internal.ediscovery.getContentContainerByContainerId(invalidUrl, uuid)).to.be.rejectedWith(Error, 'Report url does not contain a report id');

      return result;
    });

    it('GetContentContainerByContainerId by url timeout defaults to 30s', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid)
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', defaultTimeout));
        });

      return result;
    });

    it('GetContentContainerByContainerId by url timeout can be overwritten to 5s with timeout as the only option', async () => {
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 5000));
        });

      return result;
    });

    it('GetContentContainerByContainerId by url makes one request when called multiple times with identical params', async () => {
      webex.internal.ediscovery.getContentContainerByContainerId(url, uuid, {timeoutMs: 5000});
      webex.internal.ediscovery.getContentContainerByContainerId(url, uuid, {timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledOnce(webex.request);
        });

      return result;
    });

    it('GetContentContainerByContainerId by url makes multiple requests when called multiple times with different params', async () => {
      webex.internal.ediscovery.getContentContainerByContainerId(url, '0d4084ce-8cef-43fd-9313-fb64579996ba', {timeoutMs: 5000});
      webex.internal.ediscovery.getContentContainerByContainerId(url, '089fcf55-3f38-4763-a441-b1c3540404cf', {timeoutMs: 5000});
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid, {timeoutMs: 5000})
        .then(() => {
          sinon.assert.calledThrice(webex.request);
        });

      return result;
    });

    it('GetContentContainerByContainerId by url sets report in contentContainerCache if it does not exist', async () => {
      const mockResponse = {body: {containerId: uuid}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      webex.internal.ediscovery.contentContainerCache = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      const result = await webex.internal.ediscovery.getContentContainerByContainerId(url, uuid);

      assert.calledWith(webex.internal.ediscovery.contentContainerCache.has, uuid);
      assert.calledWith(webex.internal.ediscovery.contentContainerCache.set, uuid, new Map());

      return result;
    });

    it('GetContentContainerByContainerId by url retrieves container from contentContainerCache if available', async () => {
      const mockCachedContainer = {containerId: uuid};

      const containerIdMap = {
        get: sinon.stub().withArgs(uuid).returns(mockCachedContainer),
        set: sinon.stub(),
        has: sinon.stub().returns(true)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid)
        .then((res) => {
          expect(res.body).to.equal(mockCachedContainer);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 1);
          assert.callCount(containerIdMap.has, 1);
          assert.callCount(containerIdMap.get, 1);
        });

      return result;
    });

    it('GetContentContainerByContainerId by url populates contentContainerCache with container when retrieved', async () => {
      const mockResponse = {body: {containerId: uuid}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid)
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 2);
          assert.callCount(containerIdMap.has, 1);
          assert.calledWith(containerIdMap.set, mockResponse.body.containerId, mockResponse.body);
        });

      return result;
    });

    it('GetContentContainerByContainerId by url cannot write container to contentContainerCache without containerId', async () => {
      const mockResponse = {body: {}};

      webex.internal.ediscovery.request = sinon.stub().resolves(mockResponse);

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };
      const result = webex.internal.ediscovery.getContentContainerByContainerId(url, uuid)
        .then((res) => {
          expect(res).to.equal(mockResponse);
          assert.callCount(webex.internal.ediscovery.contentContainerCache.has, 2);
          assert.callCount(containerIdMap.has, 1);
          assert.notCalled(containerIdMap.set);
        });

      return result;
    });
  });

  describe('ClearCache Tests', () => {
    it('Clear caches of spaces and content containers', async () => {
      const spaceIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(spaceIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(true),
        clear: sinon.stub()
      };

      const containerIdMap = {
        set: sinon.stub(),
        has: sinon.stub().returns(false)
      };

      webex.internal.ediscovery.contentContainerCache = {
        get: sinon.stub().withArgs(uuid).returns(containerIdMap),
        set: sinon.stub(),
        has: sinon.stub().returns(false),
        clear: sinon.stub()
      };

      webex.internal.ediscovery.clearCache();

      assert.callCount(webex.internal.ediscovery.contentContainerCache.clear, 1);
    });
  });

  describe('PostAuditLog Tests', () => {
    it('PostAuditLog with valid reportId succeeds', () => {
      webex.internal.ediscovery.postAuditLog(uuid, {timeoutMs: 1000})
        .then((res) => {
          expect(res.statusCode).equal(200);
          sinon.assert.calledWith(webex.request, sinon.match.has('timeout', 1000));
        });
    });

    it('PostAuditLog with no reportId is rejected', () => {
      const noUuid = '';

      expect(webex.internal.ediscovery.postAuditLog(noUuid, {timeoutMs: 1000})).to.be.rejectedWith(Error, 'No report ID specified');
    });

    it('PostAuditLog propagates http error on failure', () => {
      webex.request = sinon.stub().returns(Promise.resolve({
        body: {},
        statusCode: 400
      }));

      webex.internal.ediscovery.postAuditLog(uuid, {timeoutMs: 1000})
        .then((res) => {
          expect(res.statusCode).equal(400);
        });
    });
  });

  describe('_getReportIdFromUrl Tests', () => {
    it('_getReportIdFromUrl of report url', async () => {
      const url = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9';

      const uuid = webex.internal.ediscovery._getReportIdFromUrl(url);

      expect(uuid).equal('16bf0d01-b1f7-483b-89a2-915144158fb9');
    });

    it('_createRequestOptions of report url with multiple uuids', async () => {
      const url = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9/contents/0498830f-1d63-4faa-b53b-35e1b12ccf9f';

      const uuid = webex.internal.ediscovery._getReportIdFromUrl(url);

      expect(uuid).equal('16bf0d01-b1f7-483b-89a2-915144158fb9');
    });
  });

  describe('_isUrl Tests', () => {
    it('_isUrl with a url', async () => {
      const url = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9';

      assert(webex.internal.ediscovery._isUrl(url));
    });

    it('_isUrl with a uuid', async () => {
      assert(!webex.internal.ediscovery._isUrl('16bf0d01-b1f7-483b-89a2-915144158fb9'));
    });

    it('_isUrl with a string', async () => {
      assert(!webex.internal.ediscovery._isUrl('abcdefghij'));
    });
  });

  describe('_createRequestOptions Tests', () => {
    it('_createRequestOptions with uuid', async () => {
      const uuid = '16bf0d01-b1f7-483b-89a2-915144158fb9';
      const resource = '/my/extra/resource/path';
      const [options, returnedUUID] = webex.internal.ediscovery._createRequestOptions(uuid, resource);

      expect(uuid).equal(returnedUUID);
      expect(options.service).equal('ediscovery');
      expect(options.resource).equal(`reports/${uuid}/${resource}`);
    });

    it('_createRequestOptions with url', async () => {
      const url = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9';
      const resource = '/my/extra/resource/path';
      const [options, returnedUUID] = webex.internal.ediscovery._createRequestOptions(url, resource);

      expect(returnedUUID).equal('16bf0d01-b1f7-483b-89a2-915144158fb9');
      expect(options.url).equal(url + resource);
    });

    it('_createRequestOptions with url with details after the uuid', async () => {
      const url = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9';
      const urlPlus = 'https://ediscovery-intb.ciscospark.com/ediscovery/api/v1/reports/16bf0d01-b1f7-483b-89a2-915144158fb9/contents/and/more';
      const resource = '/my/extra/resource/path';
      const [options, returnedUUID] = webex.internal.ediscovery._createRequestOptions(urlPlus, resource);

      expect(returnedUUID).equal('16bf0d01-b1f7-483b-89a2-915144158fb9');
      expect(options.url).equal(url + resource);
    });
  });
});
