/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import WebexCore from '@webex/webex-core';
// Importing the package for its side effect is what performs registration.
import AISummary from '@webex/internal-plugin-call-ai-summary';

import config from '../../../src/config';
import {ERROR_MESSAGES} from '../../../src/constants';
import {
  actionItemsResponse,
  flattenedContainer,
  notesResponse,
  rawPragyaContainer,
  summaryResponse,
  transcriptResponse,
} from '../fixture/responses';

describe('internal-plugin-call-ai-summary', () => {
  let webex;
  let aisummary;

  const clone = (value) => JSON.parse(JSON.stringify(value));

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        aisummary: AISummary,
      },
    });

    webex.config.aisummary = config.aisummary;
    webex.internal.encryption = {
      decryptText: sinon.stub().callsFake((keyUrl, ciphertext) => Promise.resolve(`decrypted:${ciphertext}`)),
    };

    aisummary = webex.internal.aisummary;
  });

  // MOD-007: registration happens as an import side effect. Assert it against the internal-core
  // plugin registry rather than a live WebexCore instance — constructing one boots the service
  // catalog, which fires asynchronous U2C requests that outlive the test and fail the runner.
  describe('registration', () => {
    const registeredPlugins = () =>
      (WebexCore as any).prototype._children.internal.prototype._children;

    it('registers itself as aisummary on the internal namespace', () => {
      assert.property(
        registeredPlugins(),
        'aisummary',
        'importing the package should register the aisummary internal plugin'
      );
    });

    it('registers the plugin under the AISummary namespace', () => {
      assert.equal(registeredPlugins().aisummary.prototype.namespace, 'AISummary');
    });

    it('exposes all six public methods on the registered plugin', () => {
      const {prototype} = registeredPlugins().aisummary;

      [
        'getContainer',
        'getSummary',
        'getNotes',
        'getActionItems',
        'getTranscriptUrl',
        'getTranscript',
      ].forEach((method) => {
        assert.isFunction(prototype[method], `${method} should be registered`);
      });
    });
  });

  describe('#getContainer', () => {
    it('requests the container through the pragya service catalog entry', async () => {
      webex.request = sinon.stub().resolves({body: clone(rawPragyaContainer)});

      await aisummary.getContainer({containerId: 'container-123'});

      assert.calledOnceWithExactly(webex.request, {
        method: 'GET',
        service: 'pragya',
        resource: 'containers/container-123',
      });
    });

    it('flattens summaryData.data onto summaryData', async () => {
      webex.request = sinon.stub().resolves({body: clone(rawPragyaContainer)});

      const result = await aisummary.getContainer({containerId: 'container-123'});

      assert.equal(result.summaryData.status, 'Active');
      assert.equal(result.summaryData.summaryUrl, 'https://aibridge-url/summaries/c635e870');
      assert.isUndefined(result.summaryData.data);
    });

    it('leaves summaryData untouched when the upstream body is already flat', async () => {
      webex.request = sinon.stub().resolves({body: clone(flattenedContainer)});

      const result = await aisummary.getContainer({containerId: 'container-123'});

      assert.equal(result.summaryData.summaryUrl, flattenedContainer.summaryData.summaryUrl);
    });

    // Validation runs before any request is issued, and getContainer is not async,
    // so an invalid id throws synchronously rather than rejecting.
    [
      {name: 'an empty string', containerId: ''},
      {name: 'whitespace only', containerId: '   '},
      {name: 'undefined', containerId: undefined},
      {name: 'a non-string', containerId: 42},
    ].forEach(({name, containerId}) => {
      it(`throws synchronously when containerId is ${name}`, () => {
        webex.request = sinon.stub();

        assert.throws(
          () => aisummary.getContainer({containerId}),
          ERROR_MESSAGES.INVALID_CONTAINER_ID
        );
        assert.notCalled(webex.request);
      });
    });
  });

  describe('#getSummary', () => {
    it('requests the summary url with the fields query', async () => {
      webex.request = sinon.stub().resolves({body: clone(summaryResponse)});

      await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.calledOnceWithExactly(webex.request, {
        method: 'GET',
        uri: `${flattenedContainer.summaryData.summaryUrl}?fields=note,shortnote,actionitems`,
      });
    });

    it('decrypts the note, short note and action item snippets', async () => {
      webex.request = sinon.stub().resolves({body: clone(summaryResponse)});

      const result = await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.equal(result.id, summaryResponse.id);
      assert.equal(result.note, 'decrypted:<encrypted_note_content>');
      assert.equal(result.shortNote, 'decrypted:<encrypted_short_note_content>');
      assert.lengthOf(result.actionItems, 1);
      assert.equal(
        result.actionItems[0].aiGeneratedContent,
        'decrypted:<encrypted_ai_generated_content>'
      );
      assert.equal(result.actionItems[0].editedContent, 'edited version');
    });

    it('extracts feedbackUrl from the links array', async () => {
      webex.request = sinon.stub().resolves({body: clone(summaryResponse)});

      const result = await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.equal(result.feedbackUrl, summaryResponse.links[0].href);
    });

    it('returns an undefined feedbackUrl when no feedback link is present', async () => {
      const body = clone(summaryResponse);

      body.links = [];
      webex.request = sinon.stub().resolves({body});

      const result = await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.isUndefined(result.feedbackUrl);
    });

    it('prefers the response keyUrl over containerInfo.encryptionKeyUrl', async () => {
      webex.request = sinon.stub().resolves({body: clone(summaryResponse)});

      await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.calledWith(
        webex.internal.encryption.decryptText,
        summaryResponse.keyUrl,
        '<encrypted_note_content>'
      );
    });

    it('falls back to containerInfo.encryptionKeyUrl when the response omits keyUrl', async () => {
      const body = clone(summaryResponse);

      delete body.keyUrl;
      webex.request = sinon.stub().resolves({body});

      await aisummary.getSummary({containerInfo: flattenedContainer});

      assert.calledWith(
        webex.internal.encryption.decryptText,
        flattenedContainer.encryptionKeyUrl,
        '<encrypted_note_content>'
      );
    });
  });

  describe('#getNotes', () => {
    it('fetches and decrypts notes from notesUrl', async () => {
      webex.request = sinon.stub().resolves({body: clone(notesResponse)});

      const result = await aisummary.getNotes({containerInfo: flattenedContainer});

      assert.calledOnceWithExactly(webex.request, {
        method: 'GET',
        uri: flattenedContainer.summaryData.notesUrl,
      });
      assert.equal(result.id, notesResponse.id);
      assert.equal(result.content, 'decrypted:<encrypted_content>');
      assert.equal(result.feedbackUrl, notesResponse.feedbackUrl);
    });
  });

  describe('#getActionItems', () => {
    it('unwraps the array response and decrypts every snippet', async () => {
      webex.request = sinon.stub().resolves({body: clone(actionItemsResponse)});

      const result = await aisummary.getActionItems({containerInfo: flattenedContainer});

      assert.equal(result.id, actionItemsResponse[0].id);
      assert.lengthOf(result.snippets, 1);
      assert.equal(
        result.snippets[0].aiGeneratedContent,
        'decrypted:<encrypted_ai_generated_content>'
      );
      assert.equal(result.snippets[0].editedContent, 'edited version');
    });

    it('returns an empty snippet list when the response array is empty', async () => {
      webex.request = sinon.stub().resolves({body: []});

      const result = await aisummary.getActionItems({containerInfo: flattenedContainer});

      assert.isUndefined(result.id);
      assert.deepEqual(result.snippets, []);
      assert.notCalled(webex.internal.encryption.decryptText);
    });

    it('omits editedContent when the snippet has no edited version', async () => {
      const body = clone(actionItemsResponse);

      delete body[0].snippets[0].content;
      webex.request = sinon.stub().resolves({body});

      const result = await aisummary.getActionItems({containerInfo: flattenedContainer});

      assert.isUndefined(result.snippets[0].editedContent);
    });
  });

  describe('#getTranscriptUrl', () => {
    it('returns the transcript url synchronously without a request', () => {
      webex.request = sinon.stub();

      const url = aisummary.getTranscriptUrl({containerInfo: flattenedContainer});

      assert.equal(url, flattenedContainer.summaryData.transcriptUrl);
      assert.notCalled(webex.request);
      assert.notCalled(webex.internal.encryption.decryptText);
    });
  });

  describe('#getTranscript', () => {
    it('fetches and decrypts every transcript snippet', async () => {
      webex.request = sinon.stub().resolves({body: clone(transcriptResponse)});

      const result = await aisummary.getTranscript({containerInfo: flattenedContainer});

      assert.equal(result.id, transcriptResponse.id);
      assert.equal(result.totalCount, 2);
      assert.lengthOf(result.snippets, 2);
      assert.equal(result.snippets[0].content, 'decrypted:<encrypted_snippet_1>');
      assert.equal(result.snippets[1].content, 'decrypted:<encrypted_snippet_2>');
      assert.equal(result.snippets[0].startTime, '1000');
      assert.equal(result.snippets[0].endTime, '2000');
      assert.equal(result.snippets[0].audioCSI, 'csi-1');
      assert.deepEqual(result.snippets[0].speaker, {
        speakerName: 'Ada Lovelace',
        speakerId: 'speaker-1',
      });
    });

    it('returns an empty snippet list when the transcript has no snippets', async () => {
      webex.request = sinon.stub().resolves({body: {id: 'transcript-id', totalCount: 0}});

      const result = await aisummary.getTranscript({containerInfo: flattenedContainer});

      assert.deepEqual(result.snippets, []);
    });
  });

  describe('containerInfo validation', () => {
    // Every content method validates its own summaryData url field plus the
    // encryption key before issuing a request.
    [
      {method: 'getSummary', urlField: 'summaryUrl'},
      {method: 'getNotes', urlField: 'notesUrl'},
      {method: 'getActionItems', urlField: 'actionItemsUrl'},
      {method: 'getTranscript', urlField: 'transcriptUrl'},
    ].forEach(({method, urlField}) => {
      it(`${method} rejects when ${urlField} is missing`, async () => {
        const containerInfo = clone(flattenedContainer);

        delete containerInfo.summaryData[urlField];
        webex.request = sinon.stub();

        await assert.isRejected(
          aisummary[method]({containerInfo}),
          ERROR_MESSAGES.INVALID_CONTAINER_INFO
        );
        assert.notCalled(webex.request);
      });

      it(`${method} rejects when encryptionKeyUrl is missing`, async () => {
        const containerInfo = clone(flattenedContainer);

        delete containerInfo.encryptionKeyUrl;
        webex.request = sinon.stub();

        await assert.isRejected(
          aisummary[method]({containerInfo}),
          ERROR_MESSAGES.INVALID_CONTAINER_INFO
        );
        assert.notCalled(webex.request);
      });
    });

    it('getTranscriptUrl throws synchronously when transcriptUrl is missing', () => {
      const containerInfo = clone(flattenedContainer);

      delete containerInfo.summaryData.transcriptUrl;

      assert.throws(
        () => aisummary.getTranscriptUrl({containerInfo}),
        ERROR_MESSAGES.INVALID_CONTAINER_INFO
      );
    });
  });

  describe('error normalization', () => {
    [
      {statusCode: 401, expected: ERROR_MESSAGES.AUTHENTICATION_FAILED},
      {statusCode: 403, expected: ERROR_MESSAGES.ACCESS_DENIED},
      {statusCode: 404, expected: ERROR_MESSAGES.CONTAINER_NOT_FOUND},
    ].forEach(({statusCode, expected}) => {
      it(`maps a ${statusCode} from getContainer to "${expected}"`, async () => {
        webex.request = sinon.stub().rejects(Object.assign(new Error('upstream'), {statusCode}));

        await assert.isRejected(aisummary.getContainer({containerId: 'c1'}), expected);
      });
    });

    it('maps a 404 from a content endpoint to the content-not-found message', async () => {
      webex.request = sinon.stub().rejects(Object.assign(new Error('upstream'), {statusCode: 404}));

      await assert.isRejected(
        aisummary.getNotes({containerInfo: flattenedContainer}),
        ERROR_MESSAGES.CONTENT_NOT_FOUND
      );
    });

    it('prefixes the method name for an unmapped failure', async () => {
      webex.request = sinon.stub().rejects(new Error('socket hang up'));

      await assert.isRejected(
        aisummary.getNotes({containerInfo: flattenedContainer}),
        /getNotes failed: socket hang up/
      );
    });

    it('propagates a decryption failure through error normalization', async () => {
      webex.request = sinon.stub().resolves({body: clone(notesResponse)});
      webex.internal.encryption.decryptText = sinon.stub().rejects(new Error('kms unavailable'));

      await assert.isRejected(
        aisummary.getNotes({containerInfo: flattenedContainer}),
        /getNotes failed: kms unavailable/
      );
    });
  });
});
