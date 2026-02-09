import HashTreeParser, {
  LocusInfoUpdateType,
} from '@webex/plugin-meetings/src/hashTree/hashTreeParser';
import HashTree from '@webex/plugin-meetings/src/hashTree/hashTree';
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import {EMPTY_HASH} from '@webex/plugin-meetings/src/hashTree/constants';

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
    metadata: any = exampleMetadata
  ) {
    return new HashTreeParser({
      initialLocus,
      metadata,
      webexRequest,
      locusInfoUpdateCallback: callback,
      debugId: 'test',
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
    assert.calledWith(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

      console.log(
        'callback calls',
        callback.getCalls().map((call) => JSON.stringify(call.args, null, 2))
      );
      // Verify callback was called with metadata object and removed dataset objects
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

      await parser.handleMessage(normalMessage, 'initial message');

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

      await parser.handleMessage(heartbeatMessage, 'heartbeat message');

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

      await parser.handleMessage(message, 'normal update');

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
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

    it('detects roster drop correctly', async () => {
      const parser = createHashTreeParser();

      // Stub updateItems to return true (indicating the change was applied)
      sinon.stub(parser.dataSets.self.hashTree, 'updateItems').returns([true]);

      // Send a roster drop message (SELF object with no data)
      const rosterDropMessage = {
        dataSets: [createDataSet('self', 1, 2101)],
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
            data: undefined, // No data - this indicates roster drop
          },
        ],
      };

      await parser.handleMessage(rosterDropMessage, 'roster drop message');

      // Verify callback was called with MEETING_ENDED
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.MEETING_ENDED, {
        updatedObjects: undefined,
      });

      // Verify that all timers were stopped (timer should be undefined after roster drop)
      assert.equal(parser.dataSets.self.timer, undefined);
      assert.equal(parser.dataSets.main.timer, undefined);
      assert.equal(parser.dataSets['atd-unmuted'].timer, undefined);
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

        await parser.handleMessage(message, 'initial message');

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
        assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

        await parser.handleMessage(message, 'initial message');

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

        await parser.handleMessage(message, 'message with self update');

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

        await parser.handleMessage(message, 'add visible dataset');

        // Verify that 'attendees' was added to visibleDataSets
        expect(parser.visibleDataSets.some((vds) => vds.name === 'attendees')).to.be.true;

        // Verify that a hash tree was created for 'attendees'
        assert.exists(parser.dataSets.attendees.hashTree);
        assert.equal(parser.dataSets.attendees.hashTree.numLeaves, 8);

        // Verify callback was called with the metadata update (appears twice - processed once for visible dataset changes, once in main loop)
        assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

        await parser.handleMessage(message, 'add new dataset requiring async init');

        await checkAsyncDatasetInitialization(parser, newDataSet);
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

        await parser.handleMessage(message, 'remove visible dataset');

        // Verify that 'atd-unmuted' was removed from visibleDataSets
        expect(parser.visibleDataSets.some((vds) => vds.name === 'atd-unmuted')).to.be.false;

        // Verify that the hash tree for 'atd-unmuted' was deleted
        assert.isUndefined(parser.dataSets['atd-unmuted'].hashTree);

        // Verify that the timer was cleared
        assert.isUndefined(parser.dataSets['atd-unmuted'].timer);

        // Verify callback was called with the metadata update and the removed objects (metadata appears twice - processed once for dataset changes, once in main loop)
        assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

        await parser.handleMessage(message, 'message with non-visible dataset');

        // Verify that no hash tree was created for attendees
        assert.isUndefined(parser.dataSets.attendees.hashTree);

        // Verify callback was NOT called (no updates for non-visible datasets)
        assert.notCalled(callback);
      });
    });
  });

  describe('#callLocusInfoUpdateCallback filtering', () => {
    // Helper to setup parser with initial objects and reset callback history
    async function setupParserWithObjects(locusStateElements: any[]) {
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

        await parser.handleMessage(setupMessage, 'setup');
      }

      callback.resetHistory();
      return parser;
    }

    it('filters out updates when a dataset has a higher version', async () => {
      const parser = await setupParserWithObjects([
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

      await parser.handleMessage(updateMessage, 'update with older version');

      // Callback should not be called because the update was filtered out
      assert.notCalled(callback);
    });

    it('allows updates when version is newer than existing', async () => {
      const parser = await setupParserWithObjects([
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

      await parser.handleMessage(updateMessage, 'update with newer version');

      // Callback should be called with the update
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

    it('filters out removal when object still exists in any dataset', async () => {
      const parser = await setupParserWithObjects([
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

      await parser.handleMessage(removalMessage, 'removal from one dataset');

      // Callback should not be called because object still exists in atd-unmuted
      assert.notCalled(callback);
    });

    it('allows removal when object does not exist in any dataset', async () => {
      const parser = await setupParserWithObjects([]);

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

      await parser.handleMessage(removalMessage, 'removal of non-existent object');

      // Callback should be called with the removal
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

    it('filters out removal when object exists in another dataset with newer version', async () => {
      const parser = createHashTreeParser();

      // Setup: Add object to main with version 40
      await parser.handleMessage(
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
      await parser.handleMessage(
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

      await parser.handleMessage(removalMessage, 'removal with older version');

      // Callback should not be called because object still exists with newer version
      assert.notCalled(callback);
    });

    it('filters mixed updates correctly - some pass, some filtered', async () => {
      const parser = await setupParserWithObjects([
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

      await parser.handleMessage(mixedMessage, 'mixed updates');

      // Callback should be called with only the valid updates (participant 1 v110 and participant 3 v10)
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.OBJECTS_UPDATED, {
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

    it('does not call callback when all updates are filtered out', async () => {
      const parser = await setupParserWithObjects([
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

      await parser.handleMessage(updateMessage, 'all filtered updates');

      // Callback should not be called at all
      assert.notCalled(callback);
    });

    it('checks all visible datasets when filtering', async () => {
      const parser = createHashTreeParser();

      // Setup: Add same object to multiple datasets with different versions
      await parser.handleMessage(
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

      await parser.handleMessage(
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

      await parser.handleMessage(
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

      await parser.handleMessage(updateMessage, 'update with v115');

      // Should be filtered out because self dataset has version 120
      assert.notCalled(callback);
    });

    it('does not call callback for empty locusStateElements', async () => {
      const parser = await setupParserWithObjects([]);

      const emptyMessage = {
        dataSets: [createDataSet('main', 16, 1100)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [],
      };

      await parser.handleMessage(emptyMessage, 'empty elements');

      assert.notCalled(callback);
    });

    it('always calls callback for MEETING_ENDED regardless of filtering', async () => {
      const parser = await setupParserWithObjects([
        {
          htMeta: {
            elementId: {type: 'locus' as const, id: 0, version: 100},
            dataSetNames: ['main'],
          },
          data: {info: 'data'},
        },
      ]);

      // Send roster drop message (SELF object with no data) to trigger MEETING_ENDED
      const rosterDropMessage = {
        dataSets: [createDataSet('self', 1, 2101)],
        visibleDataSetsUrl,
        locusUrl,
        locusStateElements: [
          {
            htMeta: {
              elementId: {type: 'self' as const, id: 4, version: 102},
              dataSetNames: ['self'],
            },
            data: undefined, // roster drop triggers MEETING_ENDED
          },
        ],
      };

      await parser.handleMessage(rosterDropMessage, 'roster drop message');

      // Callback should be called with MEETING_ENDED
      assert.calledOnceWithExactly(callback, LocusInfoUpdateType.MEETING_ENDED, {
        updatedObjects: undefined,
      });
    });
  });
});
