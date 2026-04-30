import HashTreeParser, {
  LocusInfoUpdateType,
  MeetingEndedError,
} from '@webex/plugin-meetings/src/hashTree/hashTreeParser';
import HashTree from '@webex/plugin-meetings/src/hashTree/hashTree';
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {EMPTY_HASH} from '@webex/plugin-meetings/src/hashTree/constants';
import { some } from 'lodash';

const visibleDataSetsUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/visibleDataSets';

const exampleInitialLocus = {
  dataSets: [
    {
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
      root: '9bb9d5a911a74d53a915b4dfbec7329f',
      version: 1000,
      leafCount: 16,
      name: 'main',
      idleMs: 1000,
      backoff: {maxMs: 1000, exponent: 2},
    },
    {
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
      root: '5b8cc7ffda1346d2bfb1c0b60b8ab601',
      version: 2000,
      leafCount: 1,
      name: 'self',
      idleMs: 1000,
      backoff: {maxMs: 1000, exponent: 2},
    },
    {
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
      root: '9279d2e149da43a1b8e2cd7cbf77f9f0',
      version: 3000,
      leafCount: 16,
      name: 'atd-unmuted',
      idleMs: 1000,
      backoff: {maxMs: 1000, exponent: 2},
    },
  ],
  locus: {
    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f',
    htMeta: {
      elementId: {
        type: 'locus',
        id: 0,
        version: 200,
      },
      dataSetNames: ['main'],
    },
    links: {resources: {visibleDataSets: {url: visibleDataSetsUrl}}},
    participants: [
      {
        url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/11941033',
        person: {},
        htMeta: {
          elementId: {
            type: 'participant',
            id: 14,
            version: 300,
          },
          dataSetNames: ['atd-active', 'attendees', 'atd-unmuted'],
        },
      },
    ],
    self: {
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/11941033',
      person: {},
      htMeta: {
        elementId: {
          type: 'self',
          id: 4,
          version: 100,
        },
        dataSetNames: ['self'],
      },
    },
  },
};

const exampleMetadata = {
  htMeta: {
    elementId: {
      type: 'metadata',
      id: 5,
      version: 50,
    },
    dataSetNames: ['self'],
  },
  visibleDataSets: [
    {name: 'main', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main'},
    {
      name: 'self',
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
    },
    {
      name: 'atd-unmuted',
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
    },
  ],
};

function createDataSet(name: string, leafCount: number, version = 1) {
  return {
    url: `https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/${name}`,
    root: '0'.repeat(32),
    version,
    leafCount,
    name,
    idleMs: 1000,
    backoff: {maxMs: 1000, exponent: 2},
  };
}

// Helper function to setup a webexRequest mock for getAllDataSetsMetadata
function mockGetAllDataSetsMetadata(webexRequest: sinon.SinonStub, url: string, dataSets: any[]) {
  webexRequest
    .withArgs(
      sinon.match({
        method: 'GET',
        uri: url,
      })
    )
    .resolves({
      body: {dataSets},
    });
}

// Helper function to setup a webexRequest mock for sync requests
function mockSyncRequest(webexRequest: sinon.SinonStub, datasetUrl: string, response: any = null) {
  const stub = webexRequest.withArgs(
    sinon.match({
      method: 'POST',
      uri: `${datasetUrl}/sync`,
    })
  );

  if (response === null) {
    stub.resolves({body: {}});
  } else {
    stub.resolves({body: response});
  }
}

describe('HashTreeParser', () => {
  const locusUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f';

  let clock;
  let webexRequest: sinon.SinonStub;
  let callback: sinon.SinonStub;
  let mathRandomStub: sinon.SinonStub;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    webexRequest = sinon.stub();
    callback = sinon.stub();
    mathRandomStub = sinon.stub(Math, 'random').returns(0);
  });
  afterEach(() => {
    clock.restore();
    mathRandomStub.restore();
  });

  // Helper to create a HashTreeParser instance with common defaults
  function createHashTreeParser(
    initialLocus: any = exampleInitialLocus,
    metadata: any = exampleMetadata,
    excludedDataSets?: string[]
  ) {
    return new HashTreeParser({
      initialLocus,
      metadata,
      webexRequest,
      locusInfoUpdateCallback: callback,
      debugId: 'test',
      excludedDataSets,
    });
  }

  // Helper to create a heartbeat message (without locusStateElements)
  function createHeartbeatMessage(
    dataSetName: string,
    leafCount: number,
    version: number,
    rootHash: string
  ) {
    return {
      dataSets: [
        {
          ...createDataSet(dataSetName, leafCount, version),
          root: rootHash,
        },
      ],
      visibleDataSetsUrl,
      locusUrl,
    };
  }

  // Helper to mock getHashesFromLocus response
  function mockGetHashesFromLocusResponse(dataSetUrl: string, hashes: string[], dataSetInfo: any) {
    webexRequest
      .withArgs(
        sinon.match({
          method: 'GET',
          uri: `${dataSetUrl}/hashtree`,
        })
      )
      .resolves({
        body: {
          hashes,
          dataSet: dataSetInfo,
        },
      });
  }

  // Helper to mock sendSyncRequestToLocus response
  function mockSendSyncRequestResponse(dataSetUrl: string, response: any) {
    webexRequest
      .withArgs(
        sinon.match({
          method: 'POST',
          uri: `${dataSetUrl}/sync`,
        })
      )
      .resolves({
        body: response,
      });
  }

  async function checkAsyncDatasetInitialization(
    parser: HashTreeParser,
    newDataSet: {name: string; leafCount: number; url: string}
  ) {
    // immediately we don't have the dataset yet, so it should not be in visibleDataSets
    // and no hash tree should exist yet
    expect(parser.visibleDataSets.some((vds) => vds.name === newDataSet.name)).to.be.false;
    assert.isUndefined(parser.dataSets[newDataSet.name]);

    // Wait for the async initialization to complete (queued as microtask)
    await clock.tickAsync(0);

    // The visibleDataSets is updated from the metadata object data
    expect(parser.visibleDataSets.some((vds) => vds.name === newDataSet.name)).to.be.true;

    // Verify that a hash tree was created for newDataSet
    assert.exists(parser.dataSets[newDataSet.name].hashTree);
    assert.equal(parser.dataSets[newDataSet.name].hashTree.numLeaves, newDataSet.leafCount);

    // Verify getAllDataSetsMetadata was called for async initialization
    assert.calledWith(
      webexRequest,
      sinon.match({
        method: 'GET',
        uri: visibleDataSetsUrl,
      })
    );

    // Verify sync request was sent for the new dataset
    assert.calledWith(
      webexRequest,
      sinon.match({
        method: 'POST',
        uri: `${newDataSet.url}/sync`,
      })
    );
  }
  it('should correctly initialize trees from initialLocus data', () => {
    const parser = createHashTreeParser();

    // verify that visibleDataSetsUrl is read out from inside locus
    expect(parser.visibleDataSetsUrl).to.equal(visibleDataSetsUrl);

    // Check that the correct number of trees are created
    expect(Object.keys(parser.dataSets).length).to.equal(3);

    // Verify the 'main' tree
    const mainTree = parser.dataSets.main.hashTree;
    expect(mainTree).to.be.instanceOf(HashTree);
    const expectedMainLeaves = new Array(16).fill(null).map(() => ({}));
    expectedMainLeaves[0 % 16] = {locus: {0: {type: 'locus', id: 0, version: 200}}};
    expect(mainTree.leaves).to.deep.equal(expectedMainLeaves);
    expect(mainTree.numLeaves).to.equal(16);

    // Verify the 'self' tree
    const selfTree = parser.dataSets.self.hashTree;
    expect(selfTree).to.be.instanceOf(HashTree);
    const expectedSelfLeaves = new Array(1).fill(null).map(() => ({}));
    // Both self (id=4) and metadata (id=5) map to the same leaf (4%1=0, 5%1=0)
    expectedSelfLeaves[0] = {
      self: {4: {type: 'self', id: 4, version: 100}},
      metadata: {5: {type: 'metadata', id: 5, version: 50}},
    };
    expect(selfTree.leaves).to.deep.equal(expectedSelfLeaves);
    expect(selfTree.numLeaves).to.equal(1);

    // Verify the 'atd-unmuted' tree
    const atdUnmutedTree = parser.dataSets['atd-unmuted'].hashTree;
    expect(atdUnmutedTree).to.be.instanceOf(HashTree);
    const expectedAtdUnmutedLeaves = new Array(16).fill(null).map(() => ({}));
    expectedAtdUnmutedLeaves[14 % 16] = {
      participant: {14: {type: 'participant', id: 14, version: 300}},
    };
    expect(atdUnmutedTree.leaves).to.deep.equal(expectedAtdUnmutedLeaves);
    expect(atdUnmutedTree.numLeaves).to.equal(16);

    // Ensure no other trees were created
    expect(parser.dataSets['atd-active']).to.be.undefined;
    expect(parser.dataSets.attendees).to.be.undefined;
  });

  it('should handle datasets with no corresponding metadata found', () => {
    const modifiedLocus = JSON.parse(JSON.stringify(exampleInitialLocus));
    // Remove a participant to simulate missing data for 'atd-unmuted'
    modifiedLocus.locus.participants = [];
    // Add a new dataset that won't have corresponding metadata
    modifiedLocus.dataSets.push({
      url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/empty-set',
      root: 'f00f00f00f00f00f00f00f00f00f00f0',
      version: 5000,
      leafCount: 4,
      name: 'empty-set',
    });

    const parser = createHashTreeParser(modifiedLocus, exampleMetadata);

    expect(Object.keys(parser.dataSets).length).to.equal(4); // main, self, atd-unmuted (now empty), empty-set

    // 'main' and 'self' should be populated as before
    const mainTree = parser.dataSets.main.hashTree;
    const expectedMainLeaves = new Array(16).fill(null).map(() => ({}));
    expectedMainLeaves[0 % 16] = {locus: {0: {type: 'locus', id: 0, version: 200}}};
    expect(mainTree.leaves).to.deep.equal(expectedMainLeaves);
    expect(mainTree.numLeaves).to.equal(16);

    const selfTree = parser.dataSets.self.hashTree;
    const expectedSelfLeaves = new Array(1).fill(null).map(() => ({}));
    expectedSelfLeaves[4 % 1] = {
      self: {4: {type: 'self', id: 4, version: 100}},
      metadata: {5: exampleMetadata.htMeta.elementId},
    };
    expect(selfTree.leaves).to.deep.equal(expectedSelfLeaves);
    expect(selfTree.numLeaves).to.equal(1);

    // 'atd-unmuted' metadata was removed from locus, so leaves should be empty
    const atdUnmutedTree = parser.dataSets['atd-unmuted'].hashTree;
    expect(atdUnmutedTree).to.be.instanceOf(HashTree);
    const expectedAtdUnmutedEmptyLeaves = new Array(16).fill(null).map(() => ({}));
    expect(atdUnmutedTree.leaves).to.deep.equal(expectedAtdUnmutedEmptyLeaves);
    expect(atdUnmutedTree.numLeaves).to.equal(16); // leafCount from dataSet definition

    // 'empty-set' was added to dataSets but has no metadata in locus and is not among visibleDataSets
    // so an entry for it should exist, but hashTree shouldn't be created
    const emptySet = parser.dataSets['empty-set'];
    expect(emptySet.hashTree).to.be.undefined;
  });

  it('should exclude datasets listed in excludedDataSets during initialization', () => {
    const parser = createHashTreeParser(exampleInitialLocus, exampleMetadata, ['atd-unmuted']);

    // 'atd-unmuted' should be excluded from visibleDataSets
    expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;

    // 'main' and 'self' should still be visible
    expect(parser.visibleDataSets.some((vds) => vds.name === 'main')).to.be.true;
    expect(parser.visibleDataSets.some((vds) => vds.name === 'self')).to.be.true;

    // 'atd-unmuted' dataset entry should exist but without a hash tree (because it's not visible)
    expect(parser.dataSets['atd-unmuted']).to.exist;
    expect(parser.dataSets['atd-unmuted'].hashTree).to.be.undefined;

    // 'main' and 'self' should have hash trees
    expect(parser.dataSets.main.hashTree).to.be.instanceOf(HashTree);
    expect(parser.dataSets.self.hashTree).to.be.instanceOf(HashTree);
  });

  it('should exclude datasets listed in excludedDataSets when adding new visible datasets', async () => {
    // Create parser without 'atd-unmuted' in initial metadata visibleDataSets
    const metadataWithoutAtdUnmuted = {
      ...exampleMetadata,
      visibleDataSets: exampleMetadata.visibleDataSets.filter((vds) => vds.name !== 'atd-unmuted'),
    };
    const parser = createHashTreeParser(exampleInitialLocus, metadataWithoutAtdUnmuted, [
      'atd-unmuted',
    ]);

    // 'atd-unmuted' should not be in visibleDataSets initially
    expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;

    // Now simulate initializeDataSets which calls addToVisibleDataSetsList
    const atdUnmutedDataSet = createDataSet('atd-unmuted', 16, 3000);

    mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [
      createDataSet('main', 16, 1000),
      createDataSet('self', 1, 2000),
      atdUnmutedDataSet,
    ]);

    mockSyncRequest(
      webexRequest,
      'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted'
    );

    const message = {
      dataSets: [createDataSet('main', 16, 1000)],
      visibleDataSetsUrl,
      locusUrl,
    };
    await parser.initializeFromMessage(message);

    // 'atd-unmuted' should still not be in visibleDataSets because it is excluded
    expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;
    // but 'main' and 'self' should be there
    expect(parser.visibleDataSets.some((vds) => vds.name === 'main')).to.be.true;
    expect(parser.visibleDataSets.some((vds) => vds.name === 'self')).to.be.true;
  });

  // helper method, needed because both initializeFromMessage and initializeFromGetLociResponse
  // do almost exactly the same thing
  const testInitializationOfDatasetsAndHashTrees = async (testCallback) => {
    // Create a parser with minimal initial data
    const minimalInitialLocus = {
      dataSets: [],
      locus: null,
    };

    const minimalMetadata = {
      htMeta: {
        elementId: {
          type: 'metadata',
          id: 5,
          version: 50,
        },
        dataSetNames: ['self'],
      },
      visibleDataSets: [
        {name: 'main', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main'},
        {
          name: 'self',
          url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
        },
      ],
    };

    const hashTreeParser = createHashTreeParser(minimalInitialLocus, minimalMetadata);

    // Setup the datasets that will be returned from getAllDataSetsMetadata
    const mainDataSet = createDataSet('main', 16, 1100);
    const selfDataSet = createDataSet('self', 1, 2100);

    mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [mainDataSet, selfDataSet]);

    // Mock sync requests for visible datasets with some updated objects
    const mainSyncResponse = {
      dataSets: [mainDataSet],
      visibleDataSetsUrl,
      locusUrl,
      locusStateElements: [
        {
          htMeta: {
            elementId: {
              type: 'locus',
              id: 1,
              version: 210,
            },
            dataSetNames: ['main'],
          },
          data: {info: {id: 'some-fake-locus-info'}},
        },
      ],
    };

    const selfSyncResponse = {
      dataSets: [selfDataSet],
      visibleDataSetsUrl,
      locusUrl,
      locusStateElements: [
        {
          htMeta: {
            elementId: {
              type: 'self',
              id: 2,
              version: 110,
            },
            dataSetNames: ['self'],
          },
          data: {person: {name: 'fake self name'}},
        },
      ],
    };

    mockSyncRequest(webexRequest, mainDataSet.url, mainSyncResponse);
    mockSyncRequest(webexRequest, selfDataSet.url, selfSyncResponse);

    // call the callback that actually calls the function being tested
    await testCallback(hashTreeParser);

    // Verify getAllDataSetsMetadata was called with correct URL
    assert.calledWith(
      webexRequest,
      sinon.match({
        method: 'GET',
        uri: visibleDataSetsUrl,
      })
    );

    // verify that visibleDataSetsUrl is set on the parser
    expect(hashTreeParser.visibleDataSetsUrl).to.equal(visibleDataSetsUrl);

    // Verify all datasets returned from visibleDataSetsUrl are added to dataSets
    expect(hashTreeParser.dataSets.main).to.exist;
    expect(hashTreeParser.dataSets.self).to.exist;

    // Verify hash trees are created only for visible datasets
    expect(hashTreeParser.dataSets.main.hashTree).to.be.instanceOf(HashTree);
    expect(hashTreeParser.dataSets.self.hashTree).to.be.instanceOf(HashTree);

    // Verify hash trees have correct leaf counts
    expect(hashTreeParser.dataSets.main.hashTree.numLeaves).to.equal(16);
    expect(hashTreeParser.dataSets.self.hashTree.numLeaves).to.equal(1);

    // Verify sync requests were sent for visible datasets
    assert.calledWith(
      webexRequest,
      sinon.match({
        method: 'POST',
        uri: `${mainDataSet.url}/sync`,
      })
    );
    assert.calledWith(
      webexRequest,
      sinon.match({
        method: 'POST',
        uri: `${selfDataSet.url}/sync`,
      })
    );

    // and no requests for hashes were sent
    assert.neverCalledWith(
      webexRequest,
      sinon.match({
        method: 'GET',
        uri: `${mainDataSet.url}/hashtree`,
      })
    );
    assert.neverCalledWith(
      webexRequest,
      sinon.match({
        method: 'GET',
        uri: `${selfDataSet.url}/hashtree`,
      })
    );

    // Verify callback was called with OBJECTS_UPDATED and correct updatedObjects list
    assert.calledWith(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
      updatedObjects: [
        {
          htMeta: {
            elementId: {
              type: 'locus',
              id: 1,
              version: 210,
            },
            dataSetNames: ['main'],
          },
          data: {info: {id: 'some-fake-locus-info'}},
        },
      ],
    });

    assert.calledWith(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
      updatedObjects: [
        {
          htMeta: {
            elementId: {
              type: 'self',
              id: 2,
              version: 110,
            },
            dataSetNames: ['self'],
          },
          data: {person: {name: 'fake self name'}},
        },
      ],
    });

    // verify that sync timers are set for visible datasets
    expect(hashTreeParser.dataSets.main.timer).to.not.be.undefined;
    expect(hashTreeParser.dataSets.self.timer).to.not.be.undefined;
  };

  describe('#initializeFromMessage', () => {
    it('fetches datasets metadata and initializes hash trees for visible data sets', async () => {
      await testInitializationOfDatasetsAndHashTrees(async (hashTreeParser: HashTreeParser) => {
        await hashTreeParser.initializeFromMessage({
          dataSets: [],
          visibleDataSetsUrl,
          locusUrl,
        });
      });
    });

    it('initializes "main" before "self" regardless of order from Locus', async () => {
      const parser = createHashTreeParser({dataSets: [], locus: null}, null);

      // Locus returns datasets in non-priority order: atd-active, main, self
      const atdActiveDataSet = createDataSet('atd-active', 4, 500);
      const mainDataSet = createDataSet('main', 16, 1100);
      const selfDataSet = createDataSet('self', 1, 2100);

      mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [
        atdActiveDataSet,
        mainDataSet,
        selfDataSet,
      ]);

      mockSyncRequest(webexRequest, selfDataSet.url);
      mockSyncRequest(webexRequest, mainDataSet.url);
      mockSyncRequest(webexRequest, atdActiveDataSet.url);

      await parser.initializeFromMessage({
        dataSets: [],
        visibleDataSetsUrl,
        locusUrl,
      });

      // Verify sync requests were sent in priority order: main, self, then atd-active
      const syncCalls = webexRequest
        .getCalls()
        .filter((call) => call.args[0]?.method === 'POST' && call.args[0]?.uri?.endsWith('/sync'));

      expect(syncCalls).to.have.lengthOf(3);
      expect(syncCalls[0].args[0].uri).to.equal(`${mainDataSet.url}/sync`);
      expect(syncCalls[1].args[0].uri).to.equal(`${selfDataSet.url}/sync`);
      expect(syncCalls[2].args[0].uri).to.equal(`${atdActiveDataSet.url}/sync`);
    });

    it('sends leafCount=1 with a single empty leaf for initialization sync, regardless of actual dataset leafCount', async () => {
      const parser = createHashTreeParser({dataSets: [], locus: null}, null);

      // Use a dataset with leafCount=16 to verify the initialization sync always uses leafCount=1
      const mainDataSet = createDataSet('main', 16, 1100);

      mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [mainDataSet]);
      mockSyncRequest(webexRequest, mainDataSet.url);

      await parser.initializeFromMessage({
        dataSets: [],
        visibleDataSetsUrl,
        locusUrl,
      });

      assert.calledWith(webexRequest, {
        method: 'POST',
        uri: `${mainDataSet.url}/sync`,
        qs: {rootHash: sinon.match.string},
        body: {
          leafCount: 1,
          leafDataEntries: [{leafIndex: 0, elementIds: []}],
        },
      });
    });

    it('handles sync response that has locusStateElements undefined', async () => {
      const minimalInitialLocus = {
        dataSets: [],
        locus: null,
      };

      const parser = createHashTreeParser(minimalInitialLocus, null);

      const mainDataSet = createDataSet('main', 16, 1100);

      // Mock getAllVisibleDataSetsFromLocus to return the main dataset
      mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [mainDataSet]);

      // Mock the sync response to have locusStateElements: undefined
      // This is what sendInitializationSyncRequestToLocus will receive and pass to parseMessage
      mockSyncRequest(webexRequest, mainDataSet.url, {
        dataSets: [mainDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: undefined,
      });

      // Trigger sendInitializationSyncRequestToLocus via initializeFromMessage
      await parser.initializeFromMessage({
        dataSets: [],
        visibleDataSetsUrl,
        locusUrl,
      });

      // Verify the hash tree was created for main dataset
      expect(parser.dataSets.main.hashTree).to.be.instanceOf(HashTree);

      // updateItems should NOT have been called because locusStateElements is undefined
      const mainUpdateItemsStub = sinon.spy(parser.dataSets.main.hashTree, 'updateItems');
      assert.notCalled(mainUpdateItemsStub);

      // callback should not be called, because there are no updates
      assert.notCalled(callback);
    });

    [404, 409].forEach((errorCode) => {
      it(`emits MeetingEndedError if getting visible datasets returns ${errorCode}`, async () => {
        const minimalInitialLocus = {
          dataSets: [],
          locus: null,
        };

        const parser = createHashTreeParser(minimalInitialLocus, null);

        // Mock getAllVisibleDataSetsFromLocus to reject with the error code
        const error: any = new Error(`Request failed with status ${errorCode}`);
        error.statusCode = errorCode;
        if (errorCode === 409) {
          error.body = {errorCode: 2403004};
        }
        webexRequest
          .withArgs(
            sinon.match({
              method: 'GET',
              uri: visibleDataSetsUrl,
            })
          )
          .rejects(error);

        // initializeFromMessage should throw MeetingEndedError
        let thrownError;
        try {
          await parser.initializeFromMessage({
            dataSets: [],
            visibleDataSetsUrl,
            locusUrl,
          });
        } catch (e) {
          thrownError = e;
        }

        expect(thrownError).to.be.instanceOf(MeetingEndedError);
      });
    });
  });

  describe('#initializeFromGetLociResponse', () => {
    it('does nothing if url for visibleDataSets is missing from locus', async () => {
      const parser = createHashTreeParser({dataSets: [], locus: {}}, null);

      await parser.initializeFromGetLociResponse({participants: []});

      assert.notCalled(webexRequest);
      assert.notCalled(callback);
    });
    it('fetches datasets metadata and initializes hash trees for visible data sets', async () => {
      await testInitializationOfDatasetsAndHashTrees(async (hashTreeParser: HashTreeParser) => {
        await hashTreeParser.initializeFromGetLociResponse({
          links: {
            resources: {
              visibleDataSets: {
                url: visibleDataSetsUrl,
              },
            },
          },
          participants: [],
        });
      });
    });
  });

  describe('#handleLocusUpdate', () => {
    it('updates hash trees based on provided new locus', () => {
      const parser = createHashTreeParser();

      const mainPutItemsSpy = sinon.spy(parser.dataSets.main.hashTree, 'putItems');
      const selfPutItemsSpy = sinon.spy(parser.dataSets.self.hashTree, 'putItems');
      const atdUnmutedPutItemsSpy = sinon.spy(parser.dataSets['atd-unmuted'].hashTree, 'putItems');

      // Create a locus update with new htMeta information for some things
      const locusUpdate = {
        dataSets: [
          createDataSet('main', 16, 1100),
          createDataSet('self', 1, 2100),
          createDataSet('atd-unmuted', 16, 3100),
        ],
        locus: {
          url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f',
          htMeta: {
            elementId: {
              type: 'locus',
              id: 0,
              version: 210, // incremented version
            },
            dataSetNames: ['main'],
          },
          participants: [
            {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/11941033',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 14,
                  version: 310, // incremented version
                },
                dataSetNames: ['atd-unmuted'],
              },
            },
            {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/22222222',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 15,
                  version: 311, // new participant
                },
                dataSetNames: ['atd-unmuted'],
              },
            },
          ],
          self: {
            url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/11941033',
            person: {},
            htMeta: {
              elementId: {
                type: 'self',
                id: 4,
                version: 100, // same version
              },
              dataSetNames: ['self'],
            },
          },
        },
      };

      // Call handleLocusUpdate
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItems was called on main hash tree with correct data
      assert.calledOnceWithExactly(mainPutItemsSpy, [{type: 'locus', id: 0, version: 210}]);

      // Verify putItems was called on self hash tree with correct data
      assert.calledOnceWithExactly(selfPutItemsSpy, [{type: 'self', id: 4, version: 100}]);

      // Verify putItems was called on atd-unmuted hash tree with correct data (2 participants)
      assert.calledOnceWithExactly(atdUnmutedPutItemsSpy, [
        {type: 'participant', id: 14, version: 310},
        {type: 'participant', id: 15, version: 311},
      ]);

      // check that the datasets metadata has been updated
      expect(parser.dataSets.main.version).to.equal(1100);
      expect(parser.dataSets.self.version).to.equal(2100);
      expect(parser.dataSets['atd-unmuted'].version).to.equal(3100);

      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {
                type: 'locus',
                id: 0,
                version: 210,
              },
              dataSetNames: ['main'],
            },
            data: {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f',
              htMeta: {
                elementId: {
                  type: 'locus',
                  id: 0,
                  version: 210,
                },
                dataSetNames: ['main'],
              },
              participants: [],
            },
          },
          {
            htMeta: {
              elementId: {
                type: 'participant',
                id: 14,
                version: 310,
              },
              dataSetNames: ['atd-unmuted'],
            },
            data: {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/11941033',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 14,
                  version: 310,
                },
                dataSetNames: ['atd-unmuted'],
              },
            },
          },
          {
            htMeta: {
              elementId: {
                type: 'participant',
                id: 15,
                version: 311,
              },
              dataSetNames: ['atd-unmuted'],
            },
            data: {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/22222222',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 15,
                  version: 311,
                },
                dataSetNames: ['atd-unmuted'],
              },
            },
          },
          // self missing, because it had the same version, so no update
        ],
      });
    });

    it('handles updates to control entries correctly', () => {
      const parser = createHashTreeParser();

      const mainPutItemsSpy = sinon.spy(parser.dataSets.main.hashTree, 'putItems');

      // Create a locus update with new htMeta information for some things
      const locusUpdate = {
        dataSets: [
          createDataSet('main', 16, 1100),
        ],
        locus: {
          url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f',
          htMeta: {
            elementId: {
              type: 'locus',
              id: 0,
              version: 200, // same version
            },
            dataSetNames: ['main'],
          },
          participants: [],
          controls: {
            lock: {
              locked: true,
              htMeta: {
                elementId: {
                  type: 'ControlEntry',
                  id: 10100,
                  version: 100,
                },
                dataSetNames: ['main'],
              },
            },
            stream: {
              streaming: true,
              htMeta: {
                elementId: {
                  type: 'ControlEntry',
                  id: 10101,
                  version: 100,
                },
                dataSetNames: ['main'],
              },
            } 
          }
        },
      };

      // Call handleLocusUpdate
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItems was called on main hash tree with correct data
      assert.calledOnceWithExactly(mainPutItemsSpy, [
        {type: 'locus', id: 0, version: 200},
        {type: 'ControlEntry', id: 10100, version: 100},
        {type: 'ControlEntry', id: 10101, version: 100}
      ]);

      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {
                type: 'ControlEntry',
                id: 10100,
                version: 100,
              },
              dataSetNames: ['main'],
            },
            data: {
              lock: {
                locked: true,
                htMeta: {
                  elementId: {
                    type: 'ControlEntry',
                    id: 10100,
                    version: 100,
                  },
                  dataSetNames: ['main'],
                },
              },
            },
          },
          {
            htMeta: {
              elementId: {
                type: 'ControlEntry',
                id: 10101,
                version: 100,
              },
              dataSetNames: ['main'],
            },
            data: {
              stream: {
                streaming: true,
                htMeta: {
                  elementId: {
                    type: 'ControlEntry',
                    id: 10101,
                    version: 100,
                  },
                  dataSetNames: ['main'],
                },
              },
            },
          }
        ],
      });
    });

    it('handles unknown datasets gracefully', () => {
      const parser = createHashTreeParser();

      const mainPutItemsSpy = sinon.spy(parser.dataSets.main.hashTree, 'putItems');

      // Create a locus update with data for an unknown dataset
      const locusUpdate = {
        dataSets: [createDataSet('main', 16)],
        locus: {
          htMeta: {
            elementId: {
              type: 'locus',
              id: 0,
              version: 201,
            },
            dataSetNames: ['main'],
          },
          someNewData: 'value',
          unknownData: {
            htMeta: {
              elementId: {
                type: 'UNKNOWN',
                id: 99,
                version: 999,
              },
              dataSetNames: ['unknown-dataset'], // dataset that doesn't exist
            },
          },
        },
      };

      // Call handleLocusUpdate - should not throw
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItems was still called for known dataset
      assert.calledOnceWithExactly(mainPutItemsSpy, [{type: 'locus', id: 0, version: 201}]);

      // Verify callback was called only for known dataset
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {
                type: 'locus',
                id: 0,
                version: 201,
              },
              dataSetNames: ['main'],
            },
            data: {
              someNewData: 'value',
              htMeta: {
                elementId: {
                  type: 'locus',
                  id: 0,
                  version: 201,
                },
                dataSetNames: ['main'],
              },
            },
          },
        ],
      });
    });

    it('handles metadata updates with new version', async () => {
      const parser = createHashTreeParser();

      const selfPutItemSpy = sinon.spy(parser.dataSets.self.hashTree, 'putItem');

      // Create a locus update with updated metadata
      const locusUpdate = {
        dataSets: [createDataSet('self', 1, 2100), createDataSet('attendees', 8, 4000)],
        locus: {
          links: {resources: {visibleDataSets: {url: visibleDataSetsUrl}}},
          participants: [
            {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/15',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 15, // new participant
                  version: 999,
                },
                dataSetNames: ['attendees'],
              },
            },
          ],
        },
        metadata: {
          htMeta: {
            elementId: {
              type: 'metadata',
              id: 5,
              version: 51, // incremented version
            },
            dataSetNames: ['self'],
          },
          // new visibleDataSets: atd-unmuted removed, "attendees" and "new-dataset" added
          visibleDataSets: [
            {
              name: 'main',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
            },
            {
              name: 'self',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
            },
            {
              name: 'new-dataset', // this one is not in dataSets, so will require async initialization
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/new-dataset',
            },
            {
              name: 'attendees', // this one is in dataSets, so should be processed immediately
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
            },
          ],
        },
      };

      // Mock the async initialization of the new dataset
      const newDataSet = createDataSet('new-dataset', 4, 5000);
      mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [newDataSet]);
      mockSyncRequest(webexRequest, newDataSet.url, {
        dataSets: [newDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      // Call handleLocusUpdate
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItem was called on self hash tree with metadata
      assert.calledOnceWithExactly(selfPutItemSpy, {type: 'metadata', id: 5, version: 51});

      // Verify callback was called with metadata object and removed dataset objects
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          // updated metadata object:
          {
            htMeta: {
              elementId: {
                type: 'metadata',
                id: 5,
                version: 51,
              },
              dataSetNames: ['self'],
            },
            data: {
              htMeta: {
                elementId: {
                  type: 'metadata',
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              visibleDataSets: [
                {
                  name: 'main',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                },
                {
                  name: 'self',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                },
                {
                  name: 'new-dataset',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/new-dataset',
                },
                {
                  name: 'attendees',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
                },
              ],
            },
          },
          // removed participant from a removed dataset 'atd-unmuted':
          {
            htMeta: {
              elementId: {
                type: 'participant',
                id: 14,
                version: 300,
              },
              dataSetNames: ['atd-unmuted'],
            },
            data: null,
          },
          // new participant from a new data set 'attendees':
          {
            htMeta: {
              elementId: {
                type: 'participant',
                id: 15,
                version: 999,
              },
              dataSetNames: ['attendees'],
            },
            data: {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/15',
              person: {},
              htMeta: {
                elementId: {
                  type: 'participant',
                  id: 15,
                  version: 999,
                },
                dataSetNames: ['attendees'],
              },
            },
          },
        ],
      });

      // verify also that an async initialization was done for
      await checkAsyncDatasetInitialization(parser, newDataSet);
    });

    it('handles metadata updates with same version (no callback)', () => {
      const parser = createHashTreeParser();

      const selfPutItemSpy = sinon.spy(parser.dataSets.self.hashTree, 'putItem');

      // Create a locus update with metadata that has the same version and same visibleDataSets
      const locusUpdate = {
        dataSets: [createDataSet('self', 1, 2100)],
        locus: {},
        metadata: {
          htMeta: {
            elementId: {
              type: 'metadata',
              id: 5,
              version: 50, // same version as initial
            },
            dataSetNames: ['self'],
          },
          visibleDataSets: [
            {
              name: 'main',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
            },
            {
              name: 'self',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
            },
            {
              name: 'atd-unmuted',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
            },
          ],
        },
      };

      // Call handleLocusUpdate
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItem was called on self hash tree
      assert.calledOnceWithExactly(selfPutItemSpy, {type: 'metadata', id: 5, version: 50});

      // Verify callback was NOT called because version didn't change
      assert.notCalled(callback);
    });

    it('handles updates with no dataSets and metadata fields gracefully', () => {
      const parser = createHashTreeParser();

      const mainPutItemsSpy = sinon.spy(parser.dataSets.main.hashTree, 'putItems');
      const selfPutItemsSpy = sinon.spy(parser.dataSets.self.hashTree, 'putItems');
      const atdUnmutedPutItemsSpy = sinon.spy(parser.dataSets['atd-unmuted'].hashTree, 'putItems');

      // Create a locus update with no dataSets and no metadata
      const locusUpdate = {
        locus: {
          htMeta: {
            elementId: {
              type: 'locus',
              id: 0,
              version: 201,
            },
            dataSetNames: ['main'],
          },
          someData: 'value',
        },
      };

      // Call handleLocusUpdate - should not throw
      parser.handleLocusUpdate(locusUpdate);

      // Verify putItems was still called for the dataset referenced in locus
      assert.calledOnceWithExactly(mainPutItemsSpy, [{type: 'locus', id: 0, version: 201}]);

      // Verify putItems was not called on other hash trees
      assert.notCalled(selfPutItemsSpy);
      assert.notCalled(atdUnmutedPutItemsSpy);

      // Verify callback was called with the updated object
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {
                type: 'locus',
                id: 0,
                version: 201,
              },
              dataSetNames: ['main'],
            },
            data: {
              someData: 'value',
              htMeta: {
                elementId: {
                  type: 'locus',
                  id: 0,
                  version: 201,
                },
                dataSetNames: ['main'],
              },
            },
          },
        ],
      });

      // Verify that dataset versions were NOT updated (no dataSets in the update)
      expect(parser.dataSets.main.version).to.equal(1000);
      expect(parser.dataSets.self.version).to.equal(2000);
      expect(parser.dataSets['atd-unmuted'].version).to.equal(3000);
    });
  });

  describe('#handleMessage', () => {
    it('handles root hash heartbeat message correctly', async () => {
      const parser = createHashTreeParser();

      // Step 1: Send a normal message with locusStateElements to start the sync timer
      const normalMessage = {
        dataSets: [
          {
            ...createDataSet('main', 16, 1100),
            root: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', // different from our hash
          },
        ],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {
                type: 'locus' as const,
                id: 0,
                version: 201,
              },
              dataSetNames: ['main'],
            },
            data: {someData: 'value'},
          },
        ],
      };

      parser.handleMessage(normalMessage, 'initial message');

      // Verify the timer was set (the sync algorithm should have started)
      expect(parser.dataSets.main.timer).to.not.be.undefined;
      const firstTimerDelay = parser.dataSets.main.idleMs; // 1000ms base + random backoff

      // Step 2: Simulate half of the time passing
      clock.tick(500);

      // Verify no webex requests have been made yet
      assert.notCalled(webexRequest);

      // Step 3: Send a heartbeat message (no locusStateElements) with mismatched root hash
      const heartbeatMessage = createHeartbeatMessage(
        'main',
        16,
        1101,
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' // still different from our hash
      );

      parser.handleMessage(heartbeatMessage, 'heartbeat message');

      // Verify the timer was restarted (should still exist)
      expect(parser.dataSets.main.timer).to.not.be.undefined;

      // Step 4: Simulate more time passing (another 500ms) - total 1000ms from start
      // This should NOT trigger the sync yet because the timer was restarted
      clock.tick(500);

      // Verify still no hash requests or sync requests were sent
      assert.notCalled(webexRequest);

      // Step 5: Mock the responses for the sync algorithm
      const mainDataSetUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main';

      // Mock getHashesFromLocus response
      mockGetHashesFromLocusResponse(
        mainDataSetUrl,
        new Array(16).fill('00000000000000000000000000000000'),
        createDataSet('main', 16, 1102)
      );

      // Mock sendSyncRequestToLocus response - use matching root hash so no new timer is started
      const syncResponseDataSet = createDataSet('main', 16, 1103);
      syncResponseDataSet.root = parser.dataSets.main.hashTree.getRootHash();
      mockSendSyncRequestResponse(mainDataSetUrl, {
        dataSets: [syncResponseDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      // Step 6: Simulate the full delay passing (another 1000ms + 0ms backoff)
      // We need to advance enough time for the restarted timer to expire
      await clock.tickAsync(1000);

      // Now verify that the sync algorithm ran:
      // 1. First, getHashesFromLocus should have been called
      assert.calledWith(
        webexRequest,
        sinon.match({
          method: 'GET',
          uri: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main/hashtree',
        })
      );

      // 2. Then, sendSyncRequestToLocus should have been called
      assert.calledWith(
        webexRequest,
        sinon.match({
          method: 'POST',
          uri: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main/sync',
        })
      );
    });

    it('handles normal updates to hash trees correctly - updates hash trees', async () => {
      const parser = createHashTreeParser();

      // Stub updateItems on hash trees
      const mainUpdateItemsStub = sinon
        .stub(parser.dataSets.main.hashTree, 'updateItems')
        .returns([true]);
      const selfUpdateItemsStub = sinon
        .stub(parser.dataSets.self.hashTree, 'updateItems')
        .returns([true]);
      const atdUnmutedUpdateItemsStub = sinon
        .stub(parser.dataSets['atd-unmuted'].hashTree, 'updateItems')
        .returns([true, true]);

      // Create a message with updates to multiple datasets
      const message = {
        dataSets: [
          createDataSet('main', 16, 1100),
          createDataSet('self', 1, 2100),
          createDataSet('atd-unmuted', 16, 3100),
        ],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {
                type: 'locus' as const,
                id: 0,
                version: 201,
              },
              dataSetNames: ['main'],
            },
            data: {info: {id: 'updated-locus-info'}},
          },
          {
            htMeta: {
              elementId: {
                type: 'self' as const,
                id: 4,
                version: 101,
              },
              dataSetNames: ['self'],
            },
            data: {person: {name: 'updated self name'}},
          },
          {
            htMeta: {
              elementId: {
                type: 'participant' as const,
                id: 14,
                version: 301,
              },
              dataSetNames: ['atd-unmuted'],
            },
            data: {person: {name: 'participant name'}},
          },
          {
            htMeta: {
              elementId: {
                type: 'participant' as const,
                id: 15,
                version: 302,
              },
              dataSetNames: ['atd-unmuted'],
            },
            data: {person: {name: 'another participant'}},
          },
        ],
      };

      parser.handleMessage(message, 'normal update');

      // Verify updateItems was called on main hash tree
      assert.calledOnceWithExactly(mainUpdateItemsStub, [
        {operation: 'update', item: {type: 'locus', id: 0, version: 201}},
      ]);

      // Verify updateItems was called on self hash tree
      assert.calledOnceWithExactly(selfUpdateItemsStub, [
        {operation: 'update', item: {type: 'self', id: 4, version: 101}},
      ]);

      // Verify updateItems was called on atd-unmuted hash tree with both participants
      assert.calledOnceWithExactly(atdUnmutedUpdateItemsStub, [
        {operation: 'update', item: {type: 'participant', id: 14, version: 301}},
        {operation: 'update', item: {type: 'participant', id: 15, version: 302}},
      ]);

      // Verify callback was called with OBJECTS_UPDATED and all updated objects
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {type: 'locus', id: 0, version: 201},
              dataSetNames: ['main'],
            },
            data: {info: {id: 'updated-locus-info'}},
          },
          {
            htMeta: {
              elementId: {type: 'self', id: 4, version: 101},
              dataSetNames: ['self'],
            },
            data: {person: {name: 'updated self name'}},
          },
          {
            htMeta: {
              elementId: {type: 'participant', id: 14, version: 301},
              dataSetNames: ['atd-unmuted'],
            },
            data: {person: {name: 'participant name'}},
          },
          {
            htMeta: {
              elementId: {type: 'participant', id: 15, version: 302},
              dataSetNames: ['atd-unmuted'],
            },
            data: {person: {name: 'another participant'}},
          },
        ],
      });
    });

    describe('handles sentinel messages correctly', () => {
      ['main', 'self', 'unjoined'].forEach((dataSetName) => {
        it('emits MEETING_ENDED for sentinel message with dataset ' + dataSetName, async () => {
          const parser = createHashTreeParser();

          // Create a sentinel message: leafCount=1, root=EMPTY_HASH, version higher than current
          const sentinelMessage = createHeartbeatMessage(
            dataSetName,
            1,
            parser.dataSets[dataSetName]?.version
              ? parser.dataSets[dataSetName].version + 1
              : 10000,
            EMPTY_HASH
          );

          // If the dataset doesn't exist yet (e.g. 'unjoined'), create it
          if (!parser.dataSets[dataSetName]) {
            parser.dataSets[dataSetName] = {
              url: `https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/${dataSetName}`,
              name: dataSetName,
              version: 1,
              leafCount: 16,
              root: '0'.repeat(32),
              idleMs: 1000,
              backoff: {maxMs: 1000, exponent: 2},
            } as any;
          }

          parser.handleMessage(sentinelMessage, 'sentinel message');

          // Verify callback was called with MEETING_ENDED
          assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});

          // Verify that all timers were stopped
          Object.values(parser.dataSets).forEach((ds: any) => {
            assert.isUndefined(ds.timer);
            assert.isUndefined(ds.heartbeatWatchdogTimer);
          });
        });
      });

      it('emits MEETING_ENDED for sentinel message with unknown dataset', async () => {
        const parser = createHashTreeParser();

        // 'unjoined' is a valid sentinel dataset name but is not tracked by the parser
        assert.isUndefined(parser.dataSets['unjoined']);

        // Create a sentinel message for 'unjoined' dataset which the parser has never seen
        const sentinelMessage = createHeartbeatMessage('unjoined', 1, 10000, EMPTY_HASH);

        parser.handleMessage(sentinelMessage, 'sentinel message');

        // Verify callback was called with MEETING_ENDED
        assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});

        // Verify that all timers were stopped
        Object.values(parser.dataSets).forEach((ds: any) => {
          assert.isUndefined(ds.timer);
          assert.isUndefined(ds.heartbeatWatchdogTimer);
        });
      });
    });

    describe('sync algorithm', () => {
      it('runs correctly after a message is received', async () => {
        const parser = createHashTreeParser();

        // Create a message with updates and mismatched root hash
        const message = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'locus' as const,
                  id: 0,
                  version: 201,
                },
                dataSetNames: ['main'],
              },
              data: {info: {id: 'initial-update'}},
            },
          ],
        };

        parser.handleMessage(message, 'initial message');

        // Verify callback was called with initial updates
        assert.calledOnce(callback);
        callback.resetHistory();

        // Setup mocks for sync algorithm
        const mainDataSetUrl = parser.dataSets.main.url;

        // Mock getHashesFromLocus response
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          createDataSet('main', 16, 1101)
        );

        // Mock sendSyncRequestToLocus response with matching root hash
        const mainSyncDataSet = createDataSet('main', 16, 1101);
        mainSyncDataSet.root = parser.dataSets.main.hashTree.getRootHash();
        mockSendSyncRequestResponse(mainDataSetUrl, {
          dataSets: [mainSyncDataSet],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'locus' as const,
                  id: 1,
                  version: 202,
                },
                dataSetNames: ['main'],
              },
              data: {info: {id: 'synced-locus'}},
            },
          ],
        });

        // Simulate time passing to trigger sync algorithm (1000ms base + 0 backoff)
        await clock.tickAsync(1000);

        // Verify that sync requests were sent for main dataset
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${mainDataSetUrl}/hashtree`,
          })
        );
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${mainDataSetUrl}/sync`,
          })
        );

        // Verify that callback was called with synced objects
        assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
          updatedObjects: [
            {
              htMeta: {
                elementId: {type: 'locus', id: 1, version: 202},
                dataSetNames: ['main'],
              },
              data: {info: {id: 'synced-locus'}},
            },
          ],
        });
      });

      describe('emits MEETING_ENDED', () => {
        [404, 409].forEach((statusCode) => {
          it(`when /hashtree returns ${statusCode}`, async () => {
            const parser = createHashTreeParser();

            // Send a message to trigger sync algorithm
            const message = {
              dataSets: [createDataSet('main', 16, 1100)],
              visibleDataSetsUrl,
              locusUrl,
              locusStateElements: [
                {
                  htMeta: {
                    elementId: {
                      type: 'locus' as const,
                      id: 0,
                      version: 201,
                    },
                    dataSetNames: ['main'],
                  },
                  data: {info: {id: 'initial-update'}},
                },
              ],
            };

            parser.handleMessage(message, 'initial message');
            callback.resetHistory();

            const mainDataSetUrl = parser.dataSets.main.url;

            // Mock getHashesFromLocus to reject with the sentinel error
            const error: any = new Error(`Request failed with status ${statusCode}`);
            error.statusCode = statusCode;
            if (statusCode === 409) {
              error.body = {errorCode: 2403004};
            }
            webexRequest
              .withArgs(
                sinon.match({
                  method: 'GET',
                  uri: `${mainDataSetUrl}/hashtree`,
                })
              )
              .rejects(error);

            // Trigger sync by advancing time
            await clock.tickAsync(1000);

            // Verify callback was called with MEETING_ENDED
            assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});

            // Verify all timers are stopped
            Object.values(parser.dataSets).forEach((ds: any) => {
              assert.isUndefined(ds.timer);
              assert.isUndefined(ds.heartbeatWatchdogTimer);
            });
          });

          it(`when /sync returns ${statusCode}`, async () => {
            const parser = createHashTreeParser();

            // Send a message to trigger sync algorithm
            const message = {
              dataSets: [createDataSet('main', 16, 1100)],
              visibleDataSetsUrl,
              locusUrl,
              locusStateElements: [
                {
                  htMeta: {
                    elementId: {
                      type: 'locus' as const,
                      id: 0,
                      version: 201,
                    },
                    dataSetNames: ['main'],
                  },
                  data: {info: {id: 'initial-update'}},
                },
              ],
            };

            parser.handleMessage(message, 'initial message');
            callback.resetHistory();

            const mainDataSetUrl = parser.dataSets.main.url;

            // Mock getHashesFromLocus to succeed
            mockGetHashesFromLocusResponse(
              mainDataSetUrl,
              new Array(16).fill('00000000000000000000000000000000'),
              createDataSet('main', 16, 1101)
            );

            // Mock sendSyncRequestToLocus to reject with the sentinel error
            const error: any = new Error(`Request failed with status ${statusCode}`);
            error.statusCode = statusCode;
            if (statusCode === 409) {
              error.body = {errorCode: 2403004};
            }
            webexRequest
              .withArgs(
                sinon.match({
                  method: 'POST',
                  uri: `${mainDataSetUrl}/sync`,
                })
              )
              .rejects(error);

            // Trigger sync by advancing time
            await clock.tickAsync(1000);

            // Verify callback was called with MEETING_ENDED
            assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});

            // Verify all timers are stopped
            Object.values(parser.dataSets).forEach((ds: any) => {
              assert.isUndefined(ds.timer);
              assert.isUndefined(ds.heartbeatWatchdogTimer);
            });
          });
        });
      });

      it('requests only mismatched hashes during sync', async () => {
        const parser = createHashTreeParser();

        // Create a message with updates to trigger sync algorithm
        const message = {
          dataSets: [createDataSet('main', 16, 1100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'locus' as const,
                  id: 0,
                  version: 201,
                },
                dataSetNames: ['main'],
              },
              data: {info: {id: 'initial-update'}},
            },
            {
              htMeta: {
                elementId: {
                  type: 'participant' as const,
                  id: 3,
                  version: 301,
                },
                dataSetNames: ['main'],
              },
              data: {id: 'participant with id=3'},
            },
            {
              htMeta: {
                elementId: {
                  type: 'participant' as const,
                  id: 4,
                  version: 301,
                },
                dataSetNames: ['main'],
              },
              data: {id: 'participant with id=4'},
            },
          ],
        };

        parser.handleMessage(message, 'initial message');

        callback.resetHistory();

        // Setup the hash tree to have specific hashes for each leaf
        // We'll make leaf 0 and leaf 4 have mismatched hashes
        const hashTree = parser.dataSets.main.hashTree;

        // Get the actual hashes for all leaves after the items were added
        const actualHashes = new Array(16);
        for (let i = 0; i < 16; i++) {
          actualHashes[i] = hashTree.leafHashes[i];
        }

        // Mock getHashesFromLocus to return hashes where most match but 0 and 4 don't
        actualHashes[0] = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
        actualHashes[4] = 'cccccccccccccccccccccccccccccccc';

        const mainDataSetUrl = parser.dataSets.main.url;
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          actualHashes,
          createDataSet('main', 16, 1101)
        );

        // Mock sendSyncRequestToLocus response with matching root hash
        const mainSyncDataSet = createDataSet('main', 16, 1101);
        mainSyncDataSet.root = hashTree.getRootHash();
        mockSendSyncRequestResponse(mainDataSetUrl, {
          dataSets: [mainSyncDataSet],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [],
        });

        // Trigger the sync algorithm by advancing time
        await clock.tickAsync(1000);

        // Verify getHashesFromLocus was called
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${mainDataSetUrl}/hashtree`,
            qs: {
              rootHash: hashTree.getRootHash(),
            },
          })
        );

        // Verify sendSyncRequestToLocus was called with only the mismatched leaf indices 0 and 4
        assert.calledWith(webexRequest, {
          method: 'POST',
          uri: `${mainDataSetUrl}/sync`,
          qs: {rootHash: hashTree.getRootHash()},
          body: {
            leafCount: 16,
            leafDataEntries: [
              {leafIndex: 0, elementIds: [{type: 'locus', id: 0, version: 201}]},
              {leafIndex: 4, elementIds: [{type: 'participant', id: 4, version: 301}]},
            ],
          },
        });
      });

      it('does not get the hashes if leafCount === 1', async () => {
        const parser = createHashTreeParser();

        // Create a message with updates to self dataset
        const message = {
          dataSets: [createDataSet('self', 1, 2001)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'self' as const,
                  id: 4,
                  version: 102,
                },
                dataSetNames: ['self'],
              },
              data: {id: 'updated self'},
            },
          ],
        };

        parser.handleMessage(message, 'message with self update');

        callback.resetHistory();

        // Trigger the sync algorithm by advancing time
        await clock.tickAsync(1000);

        // self data set has only 1 leaf, so sync should skip the step of getting hashes
        assert.neverCalledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${parser.dataSets.self.url}/hashtree`,
          })
        );

        // Verify sendSyncRequestToLocus was called with the single leaf
        assert.calledWith(webexRequest, {
          method: 'POST',
          uri: `${parser.dataSets.self.url}/sync`,
          qs: {rootHash: parser.dataSets.self.hashTree.getRootHash()},
          body: {
            leafCount: 1,
            leafDataEntries: [
              {
                leafIndex: 0,
                elementIds: [
                  {type: 'self', id: 4, version: 102},
                  {type: 'metadata', id: 5, version: 50},
                ],
              },
            ],
          },
        });
      });

      it('restarts the sync timer when sync response is empty so that a future sync can be triggered', async () => {
        const parser = createHashTreeParser();

        // Send a heartbeat with a mismatched root hash to trigger runSyncAlgorithm
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', // different from ours
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
        };

        parser.handleMessage(heartbeatMessage, 'heartbeat with mismatch');

        // The sync timer should be set
        expect(parser.dataSets.main.timer).to.not.be.undefined;

        // Mock responses for the first sync - return null (204/empty body)
        const mainDataSetUrl = parser.dataSets.main.url;
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          {
            ...createDataSet('main', 16, 1101),
            root: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', // still mismatched
          }
        );
        mockSendSyncRequestResponse(mainDataSetUrl, null);

        // Advance time to fire the sync timer (idleMs=1000 + backoff=0)
        await clock.tickAsync(1000);

        // Verify sync was triggered
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${mainDataSetUrl}/sync`,
          })
        );

        // After empty response, runSyncAlgorithm should have been called,
        // setting a new sync timer as a safety net
        expect(parser.dataSets.main.timer).to.not.be.undefined;

        // Reset and set up mocks for the second sync
        webexRequest.resetHistory();
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          {
            ...createDataSet('main', 16, 1102),
            root: 'cccccccccccccccccccccccccccccccc', // still mismatched
          }
        );
        mockSendSyncRequestResponse(mainDataSetUrl, null);

        // Advance time again to fire the second sync timer
        await clock.tickAsync(1000);

        // Verify a second sync was triggered
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${mainDataSetUrl}/sync`,
          })
        );
      });
    });

    describe('handles visible data sets changes correctly', () => {
      it('handles addition of visible data set (one that does not require async initialization)', async () => {
        // Create a parser with visible datasets
        const parser = createHashTreeParser();

        // Stub updateItems on self hash tree to return true
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Send a message with Metadata object that has a new visibleDataSets list
        const message = {
          dataSets: [createDataSet('self', 1, 2100), createDataSet('attendees', 8, 4000)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  {
                    name: 'atd-unmuted',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                  },
                  {
                    name: 'attendees',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
                  },
                ], // added 'attendees'
              },
            },
          ],
        };

        parser.handleMessage(message, 'add visible dataset');

        // Verify that 'attendees' was added to visibleDataSets
        expect(parser.visibleDataSets.some((vds) => vds.name === 'attendees')).to.be.true;

        // Verify that a hash tree was created for 'attendees'
        assert.exists(parser.dataSets.attendees.hashTree);
        assert.equal(parser.dataSets.attendees.hashTree.numLeaves, 8);

        // Verify callback was called with the metadata update (appears twice - processed once for visible dataset changes, once in main loop)
        assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
          updatedObjects: [
            {
              htMeta: {
                elementId: {type: 'metadata', id: 5, version: 51},
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  {
                    name: 'atd-unmuted',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                  },
                  {
                    name: 'attendees',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
                  },
                ],
              },
            },
            {
              htMeta: {
                elementId: {type: 'metadata', id: 5, version: 51},
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  {
                    name: 'atd-unmuted',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                  },
                  {
                    name: 'attendees',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
                  },
                ],
              },
            },
          ],
        });
      });

      it('handles addition of visible data set (one that requires async initialization)', async () => {
        // Create a parser with visible datasets
        const parser = createHashTreeParser();

        // Stub updateItems on self hash tree to return true
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Send a message with Metadata object that has a new visibleDataSets list (adding 'new-dataset')
        // but WITHOUT providing info about the new dataset in dataSets array
        const message = {
          dataSets: [createDataSet('self', 1, 2100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  {
                    name: 'atd-unmuted',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                  },
                  {
                    name: 'new-dataset',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/new-dataset',
                  },
                ],
              },
            },
          ],
        };

        // Mock the async initialization of the new dataset
        const newDataSet = createDataSet('new-dataset', 4, 5000);
        mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [newDataSet]);
        mockSyncRequest(webexRequest, newDataSet.url, {
          dataSets: [newDataSet],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [],
        });

        parser.handleMessage(message, 'add new dataset requiring async init');

        await checkAsyncDatasetInitialization(parser, newDataSet);
      });

      it('initializes new visible data sets in priority order', async () => {
        // Create a parser that only has "self" as visible (no "main")
        const initialLocusWithoutMain = {
          dataSets: [createDataSet('self', 1, 2000)],
          locus: {
            ...exampleInitialLocus.locus,
          },
        };
        const metadataWithoutMain = {
          ...exampleMetadata,
          visibleDataSets: [
            {
              name: 'self',
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
            },
          ],
        };
        const parser = createHashTreeParser(initialLocusWithoutMain, metadataWithoutMain);

        // Verify "main" is not visible initially
        expect(parser.visibleDataSets.some((vds) => vds.name === 'main')).to.be.false;

        // Stub updateItems on self hash tree to return true
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Send a message that adds "main" and "atd-active" as new visible datasets.
        // Neither has info in dataSets, so both require async initialization.
        const newMainDataSet = createDataSet('main', 16, 6000);
        const newAtdActiveDataSet = createDataSet('atd-active', 4, 7000);

        const message = {
          dataSets: [createDataSet('self', 1, 2100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  // listed in non-priority order: atd-active before main
                  {name: 'atd-active', url: newAtdActiveDataSet.url},
                  {name: 'main', url: newMainDataSet.url},
                ],
              },
            },
          ],
        };

        // Mock getAllVisibleDataSetsFromLocus to return both new datasets (in non-priority order)
        mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [
          newAtdActiveDataSet,
          newMainDataSet,
        ]);
        mockSyncRequest(webexRequest, newMainDataSet.url);
        mockSyncRequest(webexRequest, newAtdActiveDataSet.url);

        parser.handleMessage(message, 'add main and atd-active datasets');

        // Wait for the async initialization (queueMicrotask) to complete
        await clock.tickAsync(0);

        // Verify both datasets are initialized
        expect(parser.dataSets.main?.hashTree).to.exist;
        expect(parser.dataSets['atd-active']?.hashTree).to.exist;

        // Verify sync requests were sent in priority order: "main" before "atd-active",
        // even though atd-active was listed first in both the message and the Locus response
        const syncCalls = webexRequest
          .getCalls()
          .filter(
            (call) =>
              call.args[0]?.method === 'POST' &&
              call.args[0]?.uri?.endsWith('/sync') &&
              (call.args[0]?.uri?.includes('/main/') || call.args[0]?.uri?.includes('/atd-active/'))
          );

        expect(syncCalls).to.have.lengthOf(2);
        expect(syncCalls[0].args[0].uri).to.equal(`${newMainDataSet.url}/sync`);
        expect(syncCalls[1].args[0].uri).to.equal(`${newAtdActiveDataSet.url}/sync`);
      });

      it('emits MEETING_ENDED if async init of a new visible dataset fails with 404', async () => {
        const parser = createHashTreeParser();

        // Stub updateItems on self hash tree to return true
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Send a message with Metadata object that adds a new visible dataset
        const message = {
          dataSets: [createDataSet('self', 1, 2100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                  {
                    name: 'atd-unmuted',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                  },
                  {
                    name: 'new-dataset',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/new-dataset',
                  },
                ],
              },
            },
          ],
        };

        // Mock getAllDataSetsMetadata to reject with 404
        const error: any = new Error('Request failed with status 404');
        error.statusCode = 404;
        webexRequest
          .withArgs(
            sinon.match({
              method: 'GET',
              uri: visibleDataSetsUrl,
            })
          )
          .rejects(error);

        parser.handleMessage(message, 'add new dataset triggering 404');

        // The first callback call is from parseMessage with the metadata update
        callback.resetHistory();

        // Wait for the async initialization (queueMicrotask) to complete
        await clock.tickAsync(0);

        // Verify callback was called with MEETING_ENDED
        assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});
      });

      it('handles removal of visible data set', async () => {
        // Create a parser with visible datasets
        const parser = createHashTreeParser();

        // Store the initial hash tree for atd-unmuted to verify it gets deleted
        const atdUnmutedHashTree = parser.dataSets['atd-unmuted'].hashTree;
        assert.exists(atdUnmutedHashTree);

        // Stub getLeafData to return some items that will be marked as removed
        // It's called for each leaf (16 leaves), so return an array for leaf 14 and empty for others
        const getLeafDataStub = sinon.stub(atdUnmutedHashTree, 'getLeafData');
        getLeafDataStub.withArgs(14).returns([{type: 'participant', id: 14, version: 301}]);
        getLeafDataStub.returns([]);

        // Stub updateItems on self hash tree to return true
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Send a message with Metadata object that has removed 'atd-unmuted' from visibleDataSets
        const message = {
          dataSets: [createDataSet('self', 1, 2100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                ], // removed 'atd-unmuted'
              },
            },
          ],
        };

        parser.handleMessage(message, 'remove visible dataset');

        // Verify that 'atd-unmuted' was removed from visibleDataSets
        expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;

        // Verify that the hash tree for 'atd-unmuted' was deleted
        assert.isUndefined(parser.dataSets['atd-unmuted'].hashTree);

        // Verify that the timer was cleared
        assert.isUndefined(parser.dataSets['atd-unmuted'].timer);

        // Verify callback was called with the metadata update and the removed objects (metadata appears twice - processed once for dataset changes, once in main loop)
        assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
          updatedObjects: [
            {
              htMeta: {
                elementId: {type: 'metadata', id: 5, version: 51},
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                ],
              },
            },
            {
              htMeta: {
                elementId: {type: 'participant', id: 14, version: 301},
                dataSetNames: ['atd-unmuted'],
              },
              data: null,
            },
            {
              htMeta: {
                elementId: {type: 'metadata', id: 5, version: 51},
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {
                    name: 'main',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                  },
                  {
                    name: 'self',
                    url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                  },
                ],
              },
            },
          ],
        });
      });
      it('ignores data if it is not in a visible data set', async () => {
        // Create a parser with attendees in datasets but not in visibleDataSets
        const parser = createHashTreeParser({
          dataSets: [
            ...exampleInitialLocus.dataSets,
            {
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/attendees',
              root: '0'.repeat(32),
              version: 4000,
              leafCount: 8,
              name: 'attendees',
              idleMs: 1000,
              backoff: {maxMs: 1000, exponent: 2},
            },
          ],
          locus: {...exampleInitialLocus.locus},
        });

        // Verify attendees is NOT in visibleDataSets
        expect(parser.visibleDataSets.some((vds) => vds.name === 'attendees')).to.be.false;

        // Send a message with attendees data
        const message = {
          dataSets: [createDataSet('attendees', 8, 4001)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'participant' as const,
                  id: 20,
                  version: 303,
                },
                dataSetNames: ['attendees'],
              },
              data: {person: {name: 'participant in attendees'}},
            },
          ],
        };

        parser.handleMessage(message, 'message with non-visible dataset');

        // Verify that no hash tree was created for attendees
        assert.isUndefined(parser.dataSets.attendees.hashTree);

        // Verify callback was NOT called (no updates for non-visible datasets)
        assert.notCalled(callback);
      });

      it('reports update for object that moves from removed visible dataset to new visible dataset even if version is unchanged', async () => {
        // The purpose of this test is to verify that when an object
        // moves from one visible dataset to another without version change,
        // the parser still reports it as an update.
        // Locus has some additional signalling for this - the "view" property in htMeta.elementId.
        // When a view changes, the contents of the object may change even if version doesn't.
        // HashTreeParser doesn't use the "view" property, because it doesn't need to -
        // the same functionality is achieved thanks to the fact that a new visible data set means
        // a new hash tree is created, so HashTreeParser still detects the change as new
        // object is added to the new hash tree.

        // Setup: parser with visible datasets "self" and "unjoined"
        const unjoinedDataSet = createDataSet('unjoined', 4, 3000);
        const selfDataSet = createDataSet('self', 1, 2000);

        // start with Locus that has "info" in both "unjoined" and "main" datasets,
        // but only "unjoined" is visible.
        const initialLocus = {
          dataSets: [selfDataSet, unjoinedDataSet],
          locus: {
            url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f',
            links: {resources: {visibleDataSets: {url: visibleDataSetsUrl}}},
            // info object in "unjoined" dataset with version 500
            info: {
              htMeta: {
                elementId: {
                  type: 'info',
                  id: 42,
                  version: 500,
                  view: ['unjoined'], // not used by our code, but here for completeness - that's what real Locus would send
                },
                dataSetNames: ['main', 'unjoined'],
              },
              someField: 'some-initial-value',
            },
            self: {
              htMeta: {
                elementId: {
                  type: 'self',
                  id: 4,
                  version: 100,
                },
                dataSetNames: ['self'],
              },
            },
          },
        };

        const metadata = {
          htMeta: {
            elementId: {
              type: 'metadata',
              id: 5,
              version: 50,
            },
            dataSetNames: ['self'],
          },
          visibleDataSets: [
            {name: 'self', url: selfDataSet.url},
            {name: 'unjoined', url: unjoinedDataSet.url},
          ],
        };

        const parser = createHashTreeParser(initialLocus, metadata);

        // Verify initial state: unjoined is visible and has the info object
        expect(parser.visibleDataSets.some((vds) => vds.name === 'unjoined')).to.be.true;
        assert.exists(parser.dataSets.unjoined.hashTree);
        assert.equal(parser.dataSets.unjoined.hashTree?.getItemVersion(42, 'info'), 500);

        // Stub updateItems on self hash tree to return true for metadata update
        sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

        // Now send a message that:
        // 1. Changes visible datasets: removes "unjoined", adds "main"
        // 2. Contains the same info object (same id=42, same version=500) but we see the view from "main" dataset
        const mainDataSet = createDataSet('main', 16, 1000);

        const message = {
          dataSets: [selfDataSet, mainDataSet],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {
                  type: 'metadata' as const,
                  id: 5,
                  version: 51,
                },
                dataSetNames: ['self'],
              },
              data: {
                visibleDataSets: [
                  {name: 'self', url: selfDataSet.url},
                  {name: 'main', url: mainDataSet.url},
                  // "unjoined" is no longer here
                ],
              },
            },
            {
              htMeta: {
                elementId: {
                  type: 'info' as const,
                  id: 42,
                  version: 500, // same version as before
                  view: ['main'], // now points to "main" instead of "unjoined"
                },
                dataSetNames: ['main', 'unjoined'], // still in both datasets, but only "main" is visible now
              },
              data: {someNewField: 'some-value'},
            },
          ],
        };

        parser.handleMessage(message, 'visible dataset swap with same-version object');

        // Verify "unjoined" is no longer visible and "main" is now visible
        expect(parser.visibleDataSets.some((vds) => vds.name === 'unjoined')).to.be.false;
        expect(parser.visibleDataSets.some((vds) => vds.name === 'main')).to.be.true;

        // Verify the info object is now in the "main" hash tree
        assert.exists(parser.dataSets.main.hashTree);
        assert.equal(parser.dataSets.main.hashTree?.getItemVersion(42, 'info'), 500);

        // The key assertion: callback should be called with the info object update even though
        // its version hasn't changed - because visible datasets changed (moved from unjoined to main)
        assert.calledOnce(callback);
        const callbackArgs = callback.firstCall.args[0];
        assert.equal(callbackArgs.updateType, LocusInfoUpdateType.OBJECTS_UPDATED);

        // Should contain the info object update (with data)
        const infoUpdate = callbackArgs.updatedObjects.find(
          (obj) => obj.htMeta.elementId.type === 'info' && obj.htMeta.elementId.id === 42
        );
        assert.exists(infoUpdate);
        assert.deepEqual(infoUpdate.htMeta.elementId, {
          type: 'info',
          id: 42,
          version: 500,
          view: ['main'],
        });
        assert.deepEqual(infoUpdate.data, {someNewField: 'some-value'});
      });
    });

    describe('heartbeat watchdog', () => {
      it('initiates sync immediately only for the specific data set whose heartbeat watchdog fires', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send initial heartbeat message for 'main' only
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeatMessage, 'initial heartbeat');

        // Verify only 'main' watchdog timer is set
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;
        expect(parser.dataSets.self.heartbeatWatchdogTimer).to.be.undefined;
        expect(parser.dataSets['atd-unmuted'].heartbeatWatchdogTimer).to.be.undefined;

        // Mock responses for performSync (GET hashtree then POST sync for leafCount > 1)
        const mainDataSetUrl = parser.dataSets.main.url;
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          createDataSet('main', 16, 1101)
        );
        mockSendSyncRequestResponse(mainDataSetUrl, null);

        // Advance time past heartbeatIntervalMs + backoff (Math.random returns 0, so backoff = 0)
        // performSync is called immediately when the watchdog fires - no additional delay
        await clock.tickAsync(heartbeatIntervalMs);

        // Verify sync request was sent immediately for 'main' (GET hashtree + POST sync)
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${mainDataSetUrl}/hashtree`,
          })
        );

        // Verify no sync requests were sent for other datasets
        assert.neverCalledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${parser.dataSets.self.url}/sync`,
          })
        );
        assert.neverCalledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${parser.dataSets['atd-unmuted'].url}/hashtree`,
          })
        );
      });

      it('calls POST sync directly for leafCount === 1 data sets', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send heartbeat for 'self' (leafCount === 1)
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('self', 1, 2100),
              url: parser.dataSets.self.url,
              root: parser.dataSets.self.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeatMessage, 'self heartbeat');

        // Mock sync response for self
        mockSendSyncRequestResponse(parser.dataSets.self.url, null);

        // Advance time past watchdog delay
        await clock.tickAsync(heartbeatIntervalMs);

        // For leafCount === 1, performSync skips GET hashtree and goes straight to POST sync
        assert.neverCalledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${parser.dataSets.self.url}/hashtree`,
          })
        );
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${parser.dataSets.self.url}/sync`,
          })
        );
      });

      it('sets watchdog timers for each data set in the message', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send heartbeat with multiple datasets
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
            {
              ...createDataSet('self', 1, 2100),
              url: parser.dataSets.self.url,
              root: parser.dataSets.self.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeatMessage, 'multi-dataset heartbeat');

        // Watchdog timers should be set for both datasets in the message
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;
        expect(parser.dataSets.self.heartbeatWatchdogTimer).to.not.be.undefined;
        // But not for datasets not in the message
        expect(parser.dataSets['atd-unmuted'].heartbeatWatchdogTimer).to.be.undefined;
      });

      it('resets the watchdog timer for a specific data set when a new heartbeat for it is received', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send first heartbeat for 'main'
        const heartbeat1 = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeat1, 'first heartbeat');

        const firstTimer = parser.dataSets.main.heartbeatWatchdogTimer;
        expect(firstTimer).to.not.be.undefined;

        // Advance time to just before the watchdog would fire
        clock.tick(4000);

        // Send second heartbeat for 'main' - this should reset the watchdog
        const heartbeat2 = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1101),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeat2, 'second heartbeat');

        const secondTimer = parser.dataSets.main.heartbeatWatchdogTimer;
        expect(secondTimer).to.not.be.undefined;
        expect(secondTimer).to.not.equal(firstTimer);

        // Advance another 4000ms (total 8000ms from start, but only 4000ms since last heartbeat)
        // The watchdog should NOT fire yet
        await clock.tickAsync(4000);

        // No sync requests should have been sent
        assert.notCalled(webexRequest);
      });

      it('resets the watchdog timer when a normal message (with locusStateElements) is received', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send initial heartbeat to start the watchdog for 'main'
        const heartbeat = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeat, 'initial heartbeat');

        const firstTimer = parser.dataSets.main.heartbeatWatchdogTimer;
        expect(firstTimer).to.not.be.undefined;

        // Advance time partially
        clock.tick(3000);

        // Stub updateItems so the normal message is processed
        sinon.stub(parser.dataSets.main.hashTree, 'updateItems').returns([true]);

        // Send a normal message (with locusStateElements) for 'main' - should also reset watchdog
        const normalMessage = {
          dataSets: [createDataSet('main', 16, 1101)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'locus' as const, id: 0, version: 201},
                dataSetNames: ['main'],
              },
              data: {someData: 'value'},
            },
          ],
          heartbeatIntervalMs,
        };

        parser.handleMessage(normalMessage, 'normal message');

        const secondTimer = parser.dataSets.main.heartbeatWatchdogTimer;
        expect(secondTimer).to.not.be.undefined;
        expect(secondTimer).to.not.equal(firstTimer);
      });

      it('does not set the watchdog timer when heartbeatIntervalMs is not set', async () => {
        const parser = createHashTreeParser();

        // Send a heartbeat message without heartbeatIntervalMs
        const heartbeatMessage = createHeartbeatMessage(
          'main',
          16,
          1100,
          parser.dataSets.main.hashTree.getRootHash()
        );

        parser.handleMessage(heartbeatMessage, 'heartbeat without interval');

        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.be.undefined;
      });

      it('stops all watchdog timers when meeting ends via sentinel message', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send heartbeat for multiple datasets
        const heartbeat = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
            {
              ...createDataSet('self', 1, 2100),
              url: parser.dataSets.self.url,
              root: parser.dataSets.self.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeat, 'initial heartbeat');

        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;
        expect(parser.dataSets.self.heartbeatWatchdogTimer).to.not.be.undefined;

        // Send a sentinel END MEETING message
        const sentinelMessage = createHeartbeatMessage(
          'main',
          1,
          parser.dataSets.main.version + 1,
          EMPTY_HASH
        );

        parser.handleMessage(sentinelMessage as any, 'sentinel message');

        // All watchdog timers should have been stopped
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.be.undefined;
        expect(parser.dataSets.self.heartbeatWatchdogTimer).to.be.undefined;
      });

      it("uses each data set's own backoff for its watchdog delay", async () => {
        // Create a parser where datasets have different backoff configs
        const initialLocus = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1000),
              backoff: {maxMs: 500, exponent: 2},
            },
            {
              ...createDataSet('self', 1, 2000),
              url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
              backoff: {maxMs: 2000, exponent: 3},
            },
          ],
          locus: {
            ...exampleInitialLocus.locus,
          },
        };

        const metadata = {
          ...exampleMetadata,
          visibleDataSets: [
            {name: 'main', url: initialLocus.dataSets[0].url},
            {name: 'self', url: initialLocus.dataSets[1].url},
          ],
        };

        const parser = createHashTreeParser(initialLocus, metadata);
        const heartbeatIntervalMs = 5000;

        // Set Math.random to return 1 so that backoff = 1^exponent * maxMs = maxMs
        mathRandomStub.returns(1);

        // Send heartbeat for both datasets
        const heartbeat = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              backoff: {maxMs: 500, exponent: 2},
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
            {
              ...createDataSet('self', 1, 2100),
              url: parser.dataSets.self.url,
              backoff: {maxMs: 2000, exponent: 3},
              root: parser.dataSets.self.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeat, 'heartbeat');

        // 'main' watchdog delay = 5000 + 1^2 * 500 = 5500ms
        // 'self' watchdog delay = 5000 + 1^3 * 2000 = 7000ms

        // Mock sync responses
        mockGetHashesFromLocusResponse(
          parser.dataSets.main.url,
          new Array(16).fill('00000000000000000000000000000000'),
          createDataSet('main', 16, 1101)
        );
        mockSendSyncRequestResponse(parser.dataSets.main.url, null);
        mockSendSyncRequestResponse(parser.dataSets.self.url, null);

        // At 5499ms, neither watchdog should have fired
        await clock.tickAsync(5499);
        assert.notCalled(webexRequest);

        // At 5500ms, 'main' watchdog fires and performSync runs immediately
        await clock.tickAsync(1);

        // main sync should have triggered immediately (GET hashtree + POST sync)
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${parser.dataSets.main.url}/hashtree`,
          })
        );

        webexRequest.resetHistory();

        // At 7000ms, 'self' watchdog fires and performSync runs immediately
        await clock.tickAsync(1500);

        // self sync should have also triggered (POST sync only, leafCount === 1)
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'POST',
            uri: `${parser.dataSets.self.url}/sync`,
          })
        );
      });

      it('does not set watchdog for data sets without a hash tree', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // 'atd-active' is in the initial locus but is not visible (no hash tree)
        // Send heartbeat mentioning a non-visible dataset
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
            createDataSet('atd-active', 16, 4000),
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeatMessage, 'heartbeat with non-visible dataset');

        // Watchdog set for main (visible) but not for atd-active (no hash tree)
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;
        expect(parser.dataSets['atd-active']?.heartbeatWatchdogTimer).to.be.undefined;
      });

      it('restarts the watchdog timer after it fires so that future missed heartbeats still trigger syncs', async () => {
        const parser = createHashTreeParser();
        const heartbeatIntervalMs = 5000;

        // Send initial heartbeat for 'main'
        const heartbeatMessage = {
          dataSets: [
            {
              ...createDataSet('main', 16, 1100),
              root: parser.dataSets.main.hashTree.getRootHash(),
            },
          ],
          visibleDataSetsUrl,
          locusUrl,
          heartbeatIntervalMs,
        };

        parser.handleMessage(heartbeatMessage, 'initial heartbeat');
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;

        // Mock responses for performSync - return null (204/empty body)
        const mainDataSetUrl = parser.dataSets.main.url;
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          createDataSet('main', 16, 1101)
        );
        mockSendSyncRequestResponse(mainDataSetUrl, null);

        // Advance time past heartbeatIntervalMs to fire the watchdog
        await clock.tickAsync(heartbeatIntervalMs);

        // Verify sync was triggered
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${mainDataSetUrl}/hashtree`,
          })
        );

        // The watchdog timer should have been restarted after firing
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;

        // Reset call history and set up new mock responses for the second sync
        webexRequest.resetHistory();
        mockGetHashesFromLocusResponse(
          mainDataSetUrl,
          new Array(16).fill('00000000000000000000000000000000'),
          createDataSet('main', 16, 1102)
        );
        mockSendSyncRequestResponse(mainDataSetUrl, null);

        // Advance time again to fire the watchdog a second time
        await clock.tickAsync(heartbeatIntervalMs);

        // Verify a second sync was triggered
        assert.calledWith(
          webexRequest,
          sinon.match({
            method: 'GET',
            uri: `${mainDataSetUrl}/hashtree`,
          })
        );

        // And the watchdog should still be running
        expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;
      });
    });

  });

  describe('#callLocusInfoUpdateCallback filtering', () => {
    // Helper to setup parser with initial objects and reset callback history
    function setupParserWithObjects(locusStateElements: any[]) {
      const parser = createHashTreeParser();

      if (locusStateElements.length > 0) {
        // Determine which datasets to include based on the objects' dataSetNames
        const dataSetNames = new Set<string>();
        locusStateElements.forEach((element) => {
          element.htMeta?.dataSetNames?.forEach((name) => dataSetNames.add(name));
        });

        const dataSets = [];
        if (dataSetNames.has('main')) dataSets.push(createDataSet('main', 16, 1100));
        if (dataSetNames.has('self')) dataSets.push(createDataSet('self', 1, 2100));
        if (dataSetNames.has('atd-unmuted')) dataSets.push(createDataSet('atd-unmuted', 16, 3100));

        const setupMessage = {
          dataSets,
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements,
        };

        parser.handleMessage(setupMessage, 'setup');
      }

      callback.resetHistory();
      return parser;
    }

    it('filters out updates when a dataset has a higher version', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'locus' as const, id: 5, version: 100},
            dataSetNames: ['main'],
          },
          data: {existingField: 'existing'},
        },
      ]);

      // Try to update with an older version (90)
      const updateMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 5, version: 90},
              dataSetNames: ['main'],
            },
            data: {someField: 'value'},
          },
        ],
      };

      parser.handleMessage(updateMessage, 'update with older version');

      // Callback should not be called because the update was filtered out
      assert.notCalled(callback);
    });

    it('allows updates when version is newer than existing', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'locus' as const, id: 5, version: 100},
            dataSetNames: ['main'],
          },
          data: {existingField: 'existing'},
        },
      ]);

      // Try to update with a newer version (110)
      const updateMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 5, version: 110},
              dataSetNames: ['main'],
            },
            data: {someField: 'new value'},
          },
        ],
      };

      parser.handleMessage(updateMessage, 'update with newer version');

      // Callback should be called with the update
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {type: 'locus', id: 5, version: 110},
              dataSetNames: ['main'],
            },
            data: {someField: 'new value'},
          },
        ],
      });
    });

    it('filters out removal when object still exists in any dataset', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'participant' as const, id: 10, version: 50},
            dataSetNames: ['main', 'atd-unmuted'],
          },
          data: {name: 'participant'},
        },
      ]);

      // Try to remove the object from main only (it still exists in atd-unmuted)
      const removalMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 10, version: 50},
              dataSetNames: ['main'],
            },
            data: null, // removal
          },
        ],
      };

      parser.handleMessage(removalMessage, 'removal from one dataset');

      // Callback should not be called because object still exists in atd-unmuted
      assert.notCalled(callback);
    });

    it('allows removal when object does not exist in any dataset', () => {
      const parser = setupParserWithObjects([]);

      // Stub updateItems to return true (simulating that the removal was "applied")
      sinon.stub(parser.dataSets.main.hashTree, 'updateItems').returns([true]);

      // Try to remove an object that doesn't exist anywhere
      const removalMessage = {
        dataSets: [createDataSet('main', 16, 1100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 99, version: 10},
              dataSetNames: ['main'],
            },
            data: null, // removal
          },
        ],
      };

      parser.handleMessage(removalMessage, 'removal of non-existent object');

      // Callback should be called with the removal
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {type: 'participant', id: 99, version: 10},
              dataSetNames: ['main'],
            },
            data: null,
          },
        ],
      });
    });

    it('filters out removal when object exists in another dataset with newer version', () => {
      const parser = createHashTreeParser();

      // Setup: Add object to main with version 40
      parser.handleMessage(
        {
          dataSets: [createDataSet('main', 16, 1100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'participant' as const, id: 10, version: 40},
                dataSetNames: ['main'],
              },
              data: {name: 'participant v40'},
            },
          ],
        },
        'setup main'
      );

      // Add object to atd-unmuted with version 50
      parser.handleMessage(
        {
          dataSets: [createDataSet('atd-unmuted', 16, 3100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'participant' as const, id: 10, version: 50},
                dataSetNames: ['atd-unmuted'],
              },
              data: {name: 'participant v50'},
            },
          ],
        },
        'setup atd-unmuted'
      );
      callback.resetHistory();

      // Try to remove with version 40 from main
      const removalMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 10, version: 40},
              dataSetNames: ['main'],
            },
            data: null, // removal
          },
        ],
      };

      parser.handleMessage(removalMessage, 'removal with older version');

      // Callback should not be called because object still exists with newer version
      assert.notCalled(callback);
    });

    it('filters mixed updates correctly - some pass, some filtered', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'participant' as const, id: 1, version: 100},
            dataSetNames: ['main'],
          },
          data: {name: 'participant 1'},
        },
        {
          htMeta: {
            elementId: {type: 'participant' as const, id: 2, version: 50},
            dataSetNames: ['atd-unmuted'],
          },
          data: {name: 'participant 2'},
        },
      ]);

      // Send mixed updates
      const mixedMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 1, version: 110}, // newer version - should pass
              dataSetNames: ['main'],
            },
            data: {name: 'updated'},
          },
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 1, version: 90}, // older version - should be filtered
              dataSetNames: ['main'],
            },
            data: {name: 'old'},
          },
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 3, version: 10}, // new object - should pass
              dataSetNames: ['main'],
            },
            data: {name: 'new'},
          },
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 2, version: 50}, // removal but exists in atd-unmuted - should be filtered
              dataSetNames: ['main'],
            },
            data: null,
          },
        ],
      };

      parser.handleMessage(mixedMessage, 'mixed updates');

      // Callback should be called with only the valid updates (participant 1 v110 and participant 3 v10)
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.OBJECTS_UPDATED,
        updatedObjects: [
          {
            htMeta: {
              elementId: {type: 'participant', id: 1, version: 110},
              dataSetNames: ['main'],
            },
            data: {name: 'updated'},
          },
          {
            htMeta: {
              elementId: {type: 'participant', id: 3, version: 10},
              dataSetNames: ['main'],
            },
            data: {name: 'new'},
          },
        ],
      });
    });

    it('does not call callback when all updates are filtered out', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'locus' as const, id: 5, version: 100},
            dataSetNames: ['main'],
          },
          data: {existingField: 'existing'},
        },
      ]);

      // Try to update with older versions (all should be filtered)
      const updateMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 5, version: 80},
              dataSetNames: ['main'],
            },
            data: {someField: 'value'},
          },
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 5, version: 90},
              dataSetNames: ['main'],
            },
            data: {someField: 'another value'},
          },
        ],
      };

      parser.handleMessage(updateMessage, 'all filtered updates');

      // Callback should not be called at all
      assert.notCalled(callback);
    });

    it('checks all visible datasets when filtering', () => {
      const parser = createHashTreeParser();

      // Setup: Add same object to multiple datasets with different versions
      parser.handleMessage(
        {
          dataSets: [createDataSet('main', 16, 1100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'participant' as const, id: 10, version: 100},
                dataSetNames: ['main'],
              },
              data: {name: 'v100'},
            },
          ],
        },
        'setup main'
      );

      parser.handleMessage(
        {
          dataSets: [createDataSet('self', 1, 2100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'participant' as const, id: 10, version: 120}, // highest
                dataSetNames: ['self'],
              },
              data: {name: 'v120'},
            },
          ],
        },
        'setup self'
      );

      parser.handleMessage(
        {
          dataSets: [createDataSet('atd-unmuted', 16, 3100)],
          visibleDataSetsUrl,
          locusUrl,
          locusStateElements: [
            {
              htMeta: {
                elementId: {type: 'participant' as const, id: 10, version: 110},
                dataSetNames: ['atd-unmuted'],
              },
              data: {name: 'v110'},
            },
          ],
        },
        'setup atd-unmuted'
      );
      callback.resetHistory();

      // Try to update with version 115 (newer than main and atd-unmuted, but older than self)
      const updateMessage = {
        dataSets: [createDataSet('main', 16, 1101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 10, version: 115},
              dataSetNames: ['main'],
            },
            data: {name: 'update'},
          },
        ],
      };

      parser.handleMessage(updateMessage, 'update with v115');

      // Should be filtered out because self dataset has version 120
      assert.notCalled(callback);
    });

    it('does not call callback for empty locusStateElements', () => {
      const parser = setupParserWithObjects([]);

      const emptyMessage = {
        dataSets: [createDataSet('main', 16, 1100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      };

      parser.handleMessage(emptyMessage, 'empty elements');

      assert.notCalled(callback);
    });

    it('always calls callback for MEETING_ENDED regardless of filtering', () => {
      const parser = setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'locus' as const, id: 0, version: 100},
            dataSetNames: ['main'],
          },
          data: {info: 'data'},
        },
      ]);

      // Send a sentinel END MEETING message
      const sentinelMessage = createHeartbeatMessage(
        'main',
        1,
        parser.dataSets.main.version + 1,
        EMPTY_HASH
      );

      parser.handleMessage(sentinelMessage as any, 'sentinel message');

      // Callback should be called with MEETING_ENDED
      assert.calledOnceWithExactly(callback, {updateType: LocusInfoUpdateType.MEETING_ENDED});
    });
  });

  describe('#state', () => {
    it('should be initialized to active', () => {
      const parser = createHashTreeParser();

      expect(parser.state).to.equal('active');
    });
  });

  describe('#stop', () => {
    it('should set state to stopped', () => {
      const parser = createHashTreeParser();

      parser.stop();

      expect(parser.state).to.equal('stopped');
    });

    it('should clear all hash trees', () => {
      const parser = createHashTreeParser();

      expect(parser.dataSets.main.hashTree).to.be.instanceOf(HashTree);
      expect(parser.dataSets.self.hashTree).to.be.instanceOf(HashTree);

      parser.stop();

      expect(parser.dataSets.main.hashTree).to.be.undefined;
      expect(parser.dataSets.self.hashTree).to.be.undefined;
      expect(parser.dataSets['atd-unmuted'].hashTree).to.be.undefined;
    });

    it('should clear visibleDataSets', () => {
      const parser = createHashTreeParser();

      expect(parser.visibleDataSets).to.have.length.greaterThan(0);

      parser.stop();

      expect(parser.visibleDataSets).to.deep.equal([]);
    });

    it('should stop all timers', () => {
      const parser = createHashTreeParser();

      // manually set timers on data sets
      parser.dataSets.main.timer = setTimeout(() => {}, 10000);
      parser.dataSets.main.heartbeatWatchdogTimer = setTimeout(() => {}, 10000);

      parser.stop();

      expect(parser.dataSets.main.timer).to.be.undefined;
      expect(parser.dataSets.main.heartbeatWatchdogTimer).to.be.undefined;
    });

    it('should not call locusInfoUpdateCallback when async initialization of a new visible dataset completes after stop()', async () => {
      const parser = createHashTreeParser();

      // Stub updateItems on self hash tree to return true so the metadata update is applied
      sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

      // Send a message with Metadata that adds a new visible dataset requiring async initialization
      // (the new dataset is NOT in parser.dataSets, so it will go through queueInitForNewVisibleDataSets)
      const message = {
        dataSets: [createDataSet('self', 1, 2100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {
                type: 'metadata' as const,
                id: 5,
                version: 51,
              },
              dataSetNames: ['self'],
            },
            data: {
              visibleDataSets: [
                {
                  name: 'main',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main',
                },
                {
                  name: 'self',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self',
                },
                {
                  name: 'atd-unmuted',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted',
                },
                {
                  name: 'new-dataset',
                  url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/new-dataset',
                },
              ],
            },
          },
        ],
      };

      // Mock the async initialization - getAllVisibleDataSetsFromLocus and sync request
      const newDataSet = createDataSet('new-dataset', 4, 5000);
      mockGetAllDataSetsMetadata(webexRequest, visibleDataSetsUrl, [newDataSet]);
      mockSyncRequest(webexRequest, newDataSet.url, {
        dataSets: [newDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'participant' as const, id: 20, version: 100},
              dataSetNames: ['new-dataset'],
            },
            data: {person: {name: 'some participant'}},
          },
        ],
      });

      // handleMessage triggers queueInitForNewVisibleDataSets (via queueMicrotask)
      parser.handleMessage(message, 'add new dataset then stop');

      // callback is called once synchronously by handleMessage for the metadata update
      callback.resetHistory();

      // Stop the parser before the async initialization completes
      parser.stop();

      // Let the queued microtask and async initialization complete
      await clock.tickAsync(0);

      // The callback should NOT have been called again after stop()
      assert.notCalled(callback);

      // parseMessage should not have processed the sync response data,
      // so no hash tree should exist for new-dataset (stop() clears all hash trees)
      assert.isUndefined(parser.dataSets['new-dataset']?.hashTree);
    });

    it('should not call locusInfoUpdateCallback when initializeFromMessage completes after stop()', async () => {
      const minimalInitialLocus = {
        dataSets: [],
        locus: null,
      };
      const parser = createHashTreeParser(minimalInitialLocus, null);

      const mainDataSet = createDataSet('main', 16, 1100);

      // Use a deferred promise so we can control when getAllVisibleDataSetsFromLocus resolves
      let resolveGetDataSets;
      webexRequest
        .withArgs(
          sinon.match({
            method: 'GET',
            uri: visibleDataSetsUrl,
          })
        )
        .returns(
          new Promise((resolve) => {
            resolveGetDataSets = resolve;
          })
        );

      mockSyncRequest(webexRequest, mainDataSet.url, {
        dataSets: [mainDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 1, version: 210},
              dataSetNames: ['main'],
            },
            data: {info: {id: 'some-locus-info'}},
          },
        ],
      });

      // Start initializeFromMessage but don't await it
      const initPromise = parser.initializeFromMessage({
        dataSets: [],
        visibleDataSetsUrl,
        locusUrl,
      });

      // Stop the parser before the GET response arrives
      parser.stop();

      // Now resolve the pending GET request
      resolveGetDataSets({body: {dataSets: [mainDataSet]}});

      // Wait for the initializeFromMessage to finish
      await initPromise;

      // The callback should NOT have been called because the parser was stopped
      assert.notCalled(callback);

      // Even though initializeDataSets may create a hash tree entry, parseMessage
      // should have returned [] without processing the sync response objects.
      // After stop(), hash trees are cleared, so verify that main has no hash tree.
      assert.isUndefined(parser.dataSets.main?.hashTree);
    });
  });

  describe('#resumeFromMessage', () => {
    const createResumeMessage = (visibleDataSets?, dataSets?) => ({
      locusUrl,
      visibleDataSetsUrl,
      dataSets: dataSets || [
        createDataSet('main', 16, 2000),
        createDataSet('self', 1, 3000),
      ],
      locusStateElements: [
        {
          htMeta: {elementId: {type: 'metadata' as const, id: 5, version: 60}, dataSetNames: ['self']},
          data: {
            visibleDataSets: visibleDataSets || [
              {name: 'main', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main'},
              {name: 'self', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self'},
            ],
          },
        },
      ],
    });

    it('should set state back to active', () => {
      const parser = createHashTreeParser();
      parser.stop();

      expect(parser.state).to.equal('stopped');

      parser.resumeFromMessage(createResumeMessage());

      expect(parser.state).to.equal('active');
    });

    it('should not resume if message is missing metadata with visibleDataSets', () => {
      const parser = createHashTreeParser();
      parser.stop();

      parser.resumeFromMessage({
        locusUrl,
        visibleDataSetsUrl,
        dataSets: [createDataSet('main', 16, 2000)],
        locusStateElements: [],
      });

      expect(parser.state).to.equal('stopped');
    });

    it('should re-initialize dataSets from the message', () => {
      const parser = createHashTreeParser();
      parser.stop();

      const newDataSets = [
        createDataSet('main', 8, 5000),
        createDataSet('self', 2, 6000),
      ];

      parser.resumeFromMessage(createResumeMessage(undefined, newDataSets));

      expect(Object.keys(parser.dataSets)).to.have.lengthOf(2);
      expect(parser.dataSets.main.leafCount).to.equal(8);
      expect(parser.dataSets.main.version).to.equal(5000);
      expect(parser.dataSets.self.leafCount).to.equal(2);
    });

    it('should create hash trees only for visible data sets', () => {
      const parser = createHashTreeParser();
      parser.stop();

      const dataSets = [
        createDataSet('main', 16, 2000),
        createDataSet('self', 1, 3000),
        createDataSet('atd-unmuted', 16, 4000),
      ];
      const visibleDataSets = [
        {name: 'main', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main'},
        {name: 'self', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self'},
      ];

      parser.resumeFromMessage(createResumeMessage(visibleDataSets, dataSets));

      expect(parser.dataSets.main.hashTree).to.be.instanceOf(HashTree);
      expect(parser.dataSets.self.hashTree).to.be.instanceOf(HashTree);
      expect(parser.dataSets['atd-unmuted'].hashTree).to.be.undefined;
    });

    it('should call handleMessage with the resume message', () => {
      const parser = createHashTreeParser();
      parser.stop();

      const handleMessageStub = sinon.stub(parser, 'handleMessage');

      const message = createResumeMessage();
      parser.resumeFromMessage(message);

      assert.calledOnceWithExactly(handleMessageStub, message, 'on resume');
    });

    it('should set visibleDataSets from message metadata filtered by excludedDataSets', () => {
      const parser = createHashTreeParser(exampleInitialLocus, exampleMetadata, ['atd-unmuted']);
      parser.stop();

      const dataSets = [
        createDataSet('main', 16, 2000),
        createDataSet('self', 1, 3000),
        createDataSet('atd-unmuted', 16, 4000),
      ];
      const visibleDataSets = [
        {name: 'main', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/main'},
        {name: 'self', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/participant/713e9f99/datasets/self'},
        {name: 'atd-unmuted', url: 'https://locus-a.wbx2.com/locus/api/v1/loci/97d64a5f/datasets/atd-unmuted'},
      ];

      parser.resumeFromMessage(createResumeMessage(visibleDataSets, dataSets));

      expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;
      expect(parser.visibleDataSets.some((vds) => vds.name === 'main')).to.be.true;
      expect(parser.visibleDataSets.some((vds) => vds.name === 'self')).to.be.true;
    });
  });

  describe('#resumeFromApiResponse', () => {
    const exampleLocus = {
      participants: [],
    } as any;

    it('should set state to active', async () => {
      const parser = createHashTreeParser();
      parser.stop();

      expect(parser.state).to.equal('stopped');

      sinon.stub(parser, 'initializeFromGetLociResponse').resolves();

      await parser.resumeFromApiResponse(exampleLocus);

      expect(parser.state).to.equal('active');
    });

    it('should reset dataSets to empty', async () => {
      const parser = createHashTreeParser();

      expect(Object.keys(parser.dataSets).length).to.be.greaterThan(0);

      parser.stop();

      sinon.stub(parser, 'initializeFromGetLociResponse').resolves();

      await parser.resumeFromApiResponse(exampleLocus);

      expect(parser.dataSets).to.deep.equal({});
    });

    it('should call initializeFromGetLociResponse with the provided locus', async () => {
      const parser = createHashTreeParser();
      parser.stop();

      const initStub = sinon.stub(parser, 'initializeFromGetLociResponse').resolves();

      await parser.resumeFromApiResponse(exampleLocus);

      assert.calledOnceWithExactly(initStub, exampleLocus);
    });

    it('should propagate errors from initializeFromGetLociResponse', async () => {
      const parser = createHashTreeParser();
      parser.stop();

      const error = new Error('initialization failed');
      const initStub = sinon.stub(parser, 'initializeFromGetLociResponse').rejects(error);

      let caughtError: Error | undefined;
      try {
        await parser.resumeFromApiResponse(exampleLocus);
      } catch (e) {
        caughtError = e;
      }

      expect(caughtError).to.equal(error);
    });
  });

  describe('#handleLocusUpdate when stopped', () => {
    it('should return early without processing when parser is stopped', () => {
      const parser = createHashTreeParser();
      parser.stop();

      parser.handleLocusUpdate({
        dataSets: [createDataSet('main', 16, 2000)],
        locus: {participants: []},
      });

      assert.notCalled(callback);
    });
  });

  describe('#handleMessage when stopped', () => {
    it('should return early without processing when parser is stopped', () => {
      const parser = createHashTreeParser();
      parser.stop();

      parser.handleMessage({
        dataSets: [createDataSet('main', 16, 2000)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {elementId: {type: 'self' as const, id: 4, version: 200}, dataSetNames: ['self']},
            data: {id: 'new-self'},
          },
        ],
      });

      assert.notCalled(callback);
    });
  });

  describe('#syncAllDatasets', () => {
    it('should sync all datasets that have hash trees in priority order', async () => {
      const parser = createHashTreeParser();

      // parser starts with main (leafCount=16) and self (leafCount=1) as visible datasets with hash trees
      // atd-unmuted has no hash tree (not visible)
      expect(parser.dataSets.main.hashTree).to.be.instanceOf(HashTree);
      expect(parser.dataSets.self.hashTree).to.be.instanceOf(HashTree);

      const mainUrl = parser.dataSets.main.url;
      const selfUrl = parser.dataSets.self.url;

      // Mock GET hashtree for main (leafCount > 1, so it does GET first)
      mockGetHashesFromLocusResponse(
        mainUrl,
        new Array(16).fill(EMPTY_HASH),
        createDataSet('main', 16, 1100)
      );

      // Mock POST sync for main - return matching root hash so no further sync needed
      const mainSyncDataSet = createDataSet('main', 16, 1100);
      mainSyncDataSet.root = parser.dataSets.main.hashTree.getRootHash();
      mockSendSyncRequestResponse(mainUrl, {
        dataSets: [mainSyncDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      // Mock POST sync for self (leafCount=1, skips GET hashtree)
      const selfSyncDataSet = createDataSet('self', 1, 2100);
      selfSyncDataSet.root = parser.dataSets.self.hashTree.getRootHash();
      mockSendSyncRequestResponse(selfUrl, {
        dataSets: [selfSyncDataSet],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      await parser.syncAllDatasets();

      // Verify GET hashtree was called for main only (not self, because leafCount=1)
      assert.calledWith(webexRequest, sinon.match({method: 'GET', uri: `${mainUrl}/hashtree`}));
      assert.neverCalledWith(webexRequest, sinon.match({method: 'GET', uri: `${selfUrl}/hashtree`}));

      // Verify POST sync was called for both
      assert.calledWith(webexRequest, sinon.match({method: 'POST', uri: `${mainUrl}/sync`}));
      assert.calledWith(webexRequest, sinon.match({method: 'POST', uri: `${selfUrl}/sync`}));

      // Verify main was synced before self (priority order)
      const mainSyncCallIndex = webexRequest.args.findIndex(
        (args) => args[0]?.method === 'GET' && args[0]?.uri === `${mainUrl}/hashtree`
      );
      const selfSyncCallIndex = webexRequest.args.findIndex(
        (args) => args[0]?.method === 'POST' && args[0]?.uri === `${selfUrl}/sync`
      );
      expect(mainSyncCallIndex).to.be.lessThan(selfSyncCallIndex);

      // Verify isSyncAllInProgress is reset
      expect(parser.isSyncAllInProgress).to.be.false;
    });

    it('should return immediately when state is stopped', async () => {
      const parser = createHashTreeParser();
      parser.stop();

      await parser.syncAllDatasets();

      // No sync requests should have been made (only the initial sync from constructor)
      // Reset history to clear constructor calls then verify
      const callCountBefore = webexRequest.callCount;
      await parser.syncAllDatasets();
      assert.equal(webexRequest.callCount, callCountBefore);
    });

    it('should guard against concurrent calls', async () => {
      const parser = createHashTreeParser();

      const mainUrl = parser.dataSets.main.url;
      const selfUrl = parser.dataSets.self.url;

      // Use a deferred promise for the main sync to control timing
      let resolveMainSync;
      webexRequest
        .withArgs(sinon.match({method: 'GET', uri: `${mainUrl}/hashtree`}))
        .returns(new Promise((resolve) => { resolveMainSync = resolve; }));

      mockSendSyncRequestResponse(mainUrl, {
        dataSets: [createDataSet('main', 16, 1100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      mockSendSyncRequestResponse(selfUrl, {
        dataSets: [createDataSet('self', 1, 2100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      // Start first call
      const promise1 = parser.syncAllDatasets();
      // Start second call while first is in progress
      const promise2 = parser.syncAllDatasets();

      // Resolve the pending request
      resolveMainSync({
        body: {
          hashes: new Array(16).fill(EMPTY_HASH),
          dataSet: createDataSet('main', 16, 1100),
        },
      });

      await promise1;
      await promise2;

      // GET hashtree for main should only be called once (second syncAllDatasets returned immediately)
      const getHashtreeCalls = webexRequest.args.filter(
        (args) => args[0]?.method === 'GET' && args[0]?.uri === `${mainUrl}/hashtree`
      );
      expect(getHashtreeCalls).to.have.lengthOf(1);
    });

    it('should skip datasets that do not have a hash tree', async () => {
      // Create parser with metadata that only has main and self as visible (not atd-unmuted)
      const metadataWithoutAtd = {
        ...exampleMetadata,
        visibleDataSets: exampleMetadata.visibleDataSets.filter((ds) => ds.name !== 'atd-unmuted'),
      };
      const parser = createHashTreeParser(exampleInitialLocus, metadataWithoutAtd);

      // atd-unmuted is in dataSets but has no hashTree (not visible)
      expect(parser.dataSets['atd-unmuted']).to.exist;
      expect(parser.dataSets['atd-unmuted'].hashTree).to.be.undefined;

      const atdUrl = parser.dataSets['atd-unmuted'].url;
      const mainUrl = parser.dataSets.main.url;
      const selfUrl = parser.dataSets.self.url;

      mockGetHashesFromLocusResponse(
        mainUrl,
        new Array(16).fill(EMPTY_HASH),
        createDataSet('main', 16, 1100)
      );

      const mainSyncDs = createDataSet('main', 16, 1100);
      mainSyncDs.root = parser.dataSets.main.hashTree.getRootHash();
      mockSendSyncRequestResponse(mainUrl, {
        dataSets: [mainSyncDs],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      const selfSyncDs = createDataSet('self', 1, 2100);
      selfSyncDs.root = parser.dataSets.self.hashTree.getRootHash();
      mockSendSyncRequestResponse(selfUrl, {
        dataSets: [selfSyncDs],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      await parser.syncAllDatasets();

      // No requests should have been made for atd-unmuted
      assert.neverCalledWith(webexRequest, sinon.match({uri: sinon.match(atdUrl)}));
    });
  });

  describe('#handleMessage sync queue', () => {
    it('should deduplicate: not sync the same dataset twice when enqueued multiple times', async () => {
      const parser = createHashTreeParser();

      const mainUrl = parser.dataSets.main.url;

      // Setup mocks before triggering syncs
      mockGetHashesFromLocusResponse(
        mainUrl,
        new Array(16).fill(EMPTY_HASH),
        createDataSet('main', 16, 1101)
      );

      const mainSyncDs = createDataSet('main', 16, 1101);
      mainSyncDs.root = parser.dataSets.main.hashTree.getRootHash();
      mockSendSyncRequestResponse(mainUrl, {
        dataSets: [mainSyncDs],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      });

      // Send two heartbeat messages (no locusStateElements) with different root hashes for main
      parser.handleMessage(createHeartbeatMessage('main', 16, 1100, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'), 'first');
      parser.handleMessage(createHeartbeatMessage('main', 16, 1101, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2'), 'second');

      // The second call resets the timer. After 1000ms, only one sync fires.
      await clock.tickAsync(1000);

      // Only one GET hashtree call should have been made for main
      const getHashtreeCalls = webexRequest.args.filter(
        (args) => args[0]?.method === 'GET' && args[0]?.uri === `${mainUrl}/hashtree`
      );
      expect(getHashtreeCalls).to.have.lengthOf(1);
    });

    it('should stop processing the sync queue when parser is stopped mid-queue', async () => {
      const parser = createHashTreeParser();

      const mainUrl = parser.dataSets.main.url;
      const selfUrl = parser.dataSets.self.url;

      // Mock main GET hashtree with a deferred promise so we can control when it resolves
      let resolveMainHashtree;
      webexRequest
        .withArgs(sinon.match({method: 'GET', uri: `${mainUrl}/hashtree`}))
        .callsFake(() => new Promise((resolve) => { resolveMainHashtree = resolve; }));

      // Send a heartbeat message that triggers sync timers for both main and self
      parser.handleMessage(
        createHeartbeatMessage('main', 16, 1100, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'),
        'trigger main sync'
      );
      parser.handleMessage(
        createHeartbeatMessage('self', 1, 2100, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1'),
        'trigger self sync'
      );

      // Fire the timers - main sync starts (calls GET hashtree, which blocks)
      await clock.tickAsync(1000);

      // Stop the parser while main sync is in progress
      parser.stop();

      // Resolve the pending main GET request
      resolveMainHashtree({
        body: {
          hashes: new Array(16).fill(EMPTY_HASH),
          dataSet: createDataSet('main', 16, 1100),
        },
      });

      await clock.tickAsync(0);

      // Self sync should NOT have been triggered because parser was stopped
      assert.neverCalledWith(webexRequest, sinon.match({method: 'POST', uri: `${selfUrl}/sync`}));
      assert.neverCalledWith(webexRequest, sinon.match({method: 'GET', uri: `${selfUrl}/hashtree`}));
    });
  });

  describe('#stop sync queue', () => {
    it('should clear the syncQueue when stopped so remaining queued items are not processed', async () => {
      const parser = createHashTreeParser();

      const mainUrl = parser.dataSets.main.url;
      const selfUrl = parser.dataSets.self.url;

      // Mock main GET hashtree with a deferred promise so we can control when it resolves
      let resolveMainHashtree;
      webexRequest
        .withArgs(sinon.match({method: 'GET', uri: `${mainUrl}/hashtree`}))
        .callsFake(() => new Promise((resolve) => { resolveMainHashtree = resolve; }));

      // Enqueue syncs for both main and self by sending heartbeat messages
      parser.handleMessage(
        createHeartbeatMessage('main', 16, 1100, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'),
        'trigger main sync'
      );
      parser.handleMessage(
        createHeartbeatMessage('self', 1, 2100, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1'),
        'trigger self sync'
      );

      // Fire the timers - main sync starts and blocks on GET hashtree
      await clock.tickAsync(1000);

      // Verify that self is still in the queue (main is being processed, self is waiting)
      // Now stop the parser - this should clear the syncQueue
      parser.stop();

      // Resolve the pending main GET request so the in-flight sync can finish
      resolveMainHashtree({
        body: {
          hashes: new Array(16).fill(EMPTY_HASH),
          dataSet: createDataSet('main', 16, 1100),
        },
      });

      await clock.tickAsync(0);

      // Self should never have been synced because stop() cleared the queue
      const selfGetCalls = webexRequest.args.filter(
        (args) => args[0]?.method === 'GET' && args[0]?.uri === `${selfUrl}/hashtree`
      );
      expect(selfGetCalls).to.have.lengthOf(0);
    });
  });

  describe('#cleanUp', () => {
    it('should stop the parser, clear all timers and clear all dataSets', () => {
      const parser = createHashTreeParser();

      // Send a message to set up sync timers via runSyncAlgorithm
      const message = {
        dataSets: [
          {
            ...createDataSet('main', 16, 1100),
            root: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
          },
        ],
        visibleDataSetsUrl,
        locusUrl,
        heartbeatIntervalMs: 5000,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'locus' as const, id: 0, version: 201},
              dataSetNames: ['main'],
            },
            data: {someData: 'value'},
          },
        ],
      };

      parser.handleMessage(message, 'setup timers');

      // Verify timers were set by handleMessage
      expect(parser.dataSets.main.timer).to.not.be.undefined;
      expect(parser.dataSets.main.heartbeatWatchdogTimer).to.not.be.undefined;

      parser.cleanUp();

      expect(parser.state).to.equal('stopped');
      expect(parser.visibleDataSets).to.deep.equal([]);
      expect(parser.dataSets).to.deep.equal({});
    });
  });
});
