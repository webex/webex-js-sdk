import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import * as locusInfoModule from '@webex/plugin-meetings/src/locus-info';
import HashTreeParser from '@webex/plugin-meetings/src/hashTree/hashTreeParser';
import {prepareInitialLocus} from '@webex/plugin-meetings/src/hashTree/prepareInitialLocus';

const locusUrl = 'https://locus-a.wbx2.com/locus/api/v1/loci/abc123';

const metadataObject = {
  htMeta: {
    elementId: {
      type: 'Metadata',
      id: 5,
      version: 1,
    },
    dataSetNames: ['self'],
  },
  data: {
    visibleDataSets: [
      {
        name: 'main',
        url: `${locusUrl}/datasets/main`,
      },
    ],
  },
};

const baseMessage: any = {
  locusUrl,
  visibleDataSetsUrl: `${locusUrl}/visibleDataSets`,
  dataSets: [],
  locusStateElements: [metadataObject],
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('prepareInitialLocus', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return early when message is missing', () => {
    const onLocusReady = sinon.stub();

    prepareInitialLocus({
      message: undefined,
      webexRequest: sinon.stub(),
      onLocusReady,
    });

    assert.notCalled(onLocusReady);
  });

  it('should invoke callback immediately when locus already has self and info', () => {
    const readyLocus = {url: locusUrl, self: {}, info: {webExMeetingId: '123'}};
    const createLocusStub = sinon
      .stub(locusInfoModule, 'createLocusFromHashTreeMessage')
      .returns({locus: readyLocus} as any);
    const initializeStub = sinon.stub(HashTreeParser.prototype, 'initializeFromMessage');
    const onLocusReady = sinon.stub();

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady,
    });

    assert.calledOnce(createLocusStub);
    assert.calledOnceWithExactly(onLocusReady, readyLocus);
    assert.notCalled(initializeStub);
  });

  it('should hydrate locus and invoke callback with hydrated locus', async () => {
    const initialLocus = {url: locusUrl};
    const hydratedLocus = {url: locusUrl, self: {state: 'JOINED'}, info: {webExMeetingId: '123'}};

    const createLocusStub = sinon.stub(locusInfoModule, 'createLocusFromHashTreeMessage');

    createLocusStub.onFirstCall().returns({locus: initialLocus} as any);
    createLocusStub.onSecondCall().returns({locus: hydratedLocus} as any);

    const initializeStub = sinon
      .stub(HashTreeParser.prototype, 'initializeFromMessage')
      .resolves(undefined as any);
    const cleanUpStub = sinon.stub(HashTreeParser.prototype, 'cleanUp');
    const onLocusReady = sinon.stub();

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady,
    });

    await flushPromises();

    assert.calledOnce(initializeStub);
    assert.calledOnce(cleanUpStub);
    assert.calledTwice(createLocusStub);
    assert.calledOnceWithExactly(onLocusReady, hydratedLocus);
  });

  it('should invoke callback with initial locus when hydration fails', async () => {
    const initialLocus = {url: locusUrl};
    const error = new Error('sync failed');

    sinon.stub(locusInfoModule, 'createLocusFromHashTreeMessage').returns({locus: initialLocus} as any);
    sinon.stub(HashTreeParser.prototype, 'initializeFromMessage').rejects(error);
    const cleanUpStub = sinon.stub(HashTreeParser.prototype, 'cleanUp');
    const onLocusReady = sinon.stub();

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady,
    });

    await flushPromises();

    assert.calledOnce(cleanUpStub);
    assert.calledOnce(onLocusReady);
    assert.calledWithExactly(onLocusReady, initialLocus);
  });

  it('should deduplicate concurrent hydration by locusUrl', async () => {
    const initialLocus = {url: locusUrl};
    let resolveFirstHydration;
    const firstHydrationPromise = new Promise<void>((resolve) => {
      resolveFirstHydration = resolve;
    });

    sinon.stub(locusInfoModule, 'createLocusFromHashTreeMessage').returns({locus: initialLocus} as any);

    const initializeStub = sinon
      .stub(HashTreeParser.prototype, 'initializeFromMessage')
      .onFirstCall()
      .returns(firstHydrationPromise)
      .onSecondCall()
      .resolves(undefined as any);

    sinon.stub(HashTreeParser.prototype, 'cleanUp');
    const logStub = sinon.stub(LoggerProxy.logger, 'log');

    const onLocusReadyFirst = sinon.stub();
    const onLocusReadySecond = sinon.stub();
    const onLocusReadyThird = sinon.stub();

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady: onLocusReadyFirst,
    });

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady: onLocusReadySecond,
    });

    assert.calledOnce(initializeStub);
    assert.calledOnce(logStub);
    assert.notCalled(onLocusReadySecond);

    resolveFirstHydration();
    await flushPromises();

    assert.calledOnce(onLocusReadyFirst);

    prepareInitialLocus({
      message: baseMessage,
      webexRequest: sinon.stub(),
      onLocusReady: onLocusReadyThird,
    });

    await flushPromises();

    assert.calledTwice(initializeStub);
    assert.calledOnce(onLocusReadyThird);
  });
});
