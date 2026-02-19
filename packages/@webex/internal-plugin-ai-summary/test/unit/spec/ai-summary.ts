/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {expect} from '@webex/test-helper-chai';
import AISummary from '@webex/internal-plugin-ai-summary';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import config from '@webex/internal-plugin-ai-summary/src/config';
import {ERROR_MESSAGES} from '@webex/internal-plugin-ai-summary/src/constants';
import {
  MOCK_CONTAINER_RESPONSE,
  MOCK_ENCRYPTION_KEY_URL,
  MOCK_SUMMARY_RESPONSE,
  MOCK_NOTES_RESPONSE,
  MOCK_NOTES_RESPONSE_NO_FEEDBACK,
  MOCK_ACTION_ITEMS_RESPONSE,
  MOCK_ACTION_ITEMS_EMPTY_SNIPPETS,
} from '../data/responses';

chai.use(chaiAsPromised);

describe('internal-plugin-ai-summary', () => {
  describe('AISummary', () => {
    let webex;

    beforeEach(() => {
      webex = MockWebex({
        children: {
          aisummary: AISummary,
        },
      });

      webex.config.aisummary = config.aisummary;

      webex.internal.encryption = {
        decryptText: sinon.stub().resolves('decrypted content'),
      };
    });

    // --------------------------------------------------------
    // getContainer
    // --------------------------------------------------------
    describe('#getContainer', () => {
      it('should resolve a Pragya container by ID', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_CONTAINER_RESPONSE});

        const result = await webex.internal.aisummary.getContainer({
          containerId: 'container-123',
        });

        expect(result.summaryData.status).to.equal('Active');
        expect(result.encryptionKeyUrl).to.equal(MOCK_ENCRYPTION_KEY_URL);
        expect(result.summaryData.summaryUrl).to.equal(
          MOCK_CONTAINER_RESPONSE.summaryData.summaryUrl
        );

        expect(webex.request.calledOnce).to.be.true;
        const callArgs = webex.request.getCall(0).args[0];
        expect(callArgs.method).to.equal('GET');
        expect(callArgs.service).to.equal('pragya');
        expect(callArgs.resource).to.equal('containers/container-123');
      });

      it('should throw for empty containerId', () => {
        expect(() =>
          webex.internal.aisummary.getContainer({containerId: ''})
        ).to.throw(ERROR_MESSAGES.INVALID_CONTAINER_ID);
      });

      it('should throw for undefined containerId', () => {
        expect(() =>
          webex.internal.aisummary.getContainer({containerId: undefined})
        ).to.throw(ERROR_MESSAGES.INVALID_CONTAINER_ID);
      });

      it('should throw for whitespace-only containerId', () => {
        expect(() =>
          webex.internal.aisummary.getContainer({containerId: '   '})
        ).to.throw(ERROR_MESSAGES.INVALID_CONTAINER_ID);
      });

      it('should handle 404 errors', async () => {
        webex.request = sinon.stub().rejects({statusCode: 404, message: 'Not Found'});

        await expect(
          webex.internal.aisummary.getContainer({containerId: 'nonexistent'})
        ).to.be.rejectedWith(ERROR_MESSAGES.CONTAINER_NOT_FOUND);
      });

      it('should handle 403 errors', async () => {
        webex.request = sinon.stub().rejects({statusCode: 403, message: 'Forbidden'});

        await expect(
          webex.internal.aisummary.getContainer({containerId: 'restricted'})
        ).to.be.rejectedWith(ERROR_MESSAGES.ACCESS_DENIED);
      });

      it('should handle 401 errors', async () => {
        webex.request = sinon.stub().rejects({statusCode: 401, message: 'Unauthorized'});

        await expect(
          webex.internal.aisummary.getContainer({containerId: 'any-id'})
        ).to.be.rejectedWith(ERROR_MESSAGES.AUTHENTICATION_FAILED);
      });
    });

    // --------------------------------------------------------
    // getSummary
    // --------------------------------------------------------
    describe('#getSummary', () => {
      it('should fetch and decrypt summary content', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_SUMMARY_RESPONSE});
        webex.internal.encryption.decryptText.resolves('The call discussed project timelines.');

        const result = await webex.internal.aisummary.getSummary({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('summary-id-001');
        expect(result.content).to.equal('The call discussed project timelines.');
        expect(result.feedbackUrl).to.equal(MOCK_SUMMARY_RESPONSE.feedbackUrl);

        expect(webex.request.calledOnce).to.be.true;
        const callArgs = webex.request.getCall(0).args[0];
        expect(callArgs.method).to.equal('GET');
        expect(callArgs.uri).to.equal(MOCK_CONTAINER_RESPONSE.summaryData.summaryUrl);

        expect(webex.internal.encryption.decryptText.calledOnce).to.be.true;
        expect(
          webex.internal.encryption.decryptText.calledWith(
            MOCK_ENCRYPTION_KEY_URL,
            'encrypted-summary-content'
          )
        ).to.be.true;
      });

      it('should reject when containerInfo is missing summaryUrl', async () => {
        await expect(
          webex.internal.aisummary.getSummary({
            containerInfo: {summaryData: {}, encryptionKeyUrl: MOCK_ENCRYPTION_KEY_URL},
          })
        ).to.be.rejectedWith(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });

      it('should reject when containerInfo is missing encryptionKeyUrl', async () => {
        await expect(
          webex.internal.aisummary.getSummary({
            containerInfo: {
              summaryData: {summaryUrl: 'https://some-url'},
              encryptionKeyUrl: undefined,
            },
          })
        ).to.be.rejectedWith(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });

      it('should handle HTTP errors from summary endpoint', async () => {
        webex.request = sinon.stub().rejects({statusCode: 404, message: 'Not Found'});

        await expect(
          webex.internal.aisummary.getSummary({containerInfo: MOCK_CONTAINER_RESPONSE})
        ).to.be.rejectedWith(ERROR_MESSAGES.CONTAINER_NOT_FOUND);
      });
    });

    // --------------------------------------------------------
    // getNotes
    // --------------------------------------------------------
    describe('#getNotes', () => {
      it('should fetch and decrypt notes', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_NOTES_RESPONSE});
        webex.internal.encryption.decryptText.resolves('These are the meeting notes.');

        const result = await webex.internal.aisummary.getNotes({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('notes-id-001');
        expect(result.content).to.equal('These are the meeting notes.');
        expect(result.feedbackUrl).to.equal(MOCK_NOTES_RESPONSE.feedbackUrl);

        const callArgs = webex.request.getCall(0).args[0];
        expect(callArgs.uri).to.equal(MOCK_CONTAINER_RESPONSE.summaryData.notesUrl);

        expect(
          webex.internal.encryption.decryptText.calledWith(
            MOCK_ENCRYPTION_KEY_URL,
            'encrypted-notes-content'
          )
        ).to.be.true;
      });

      it('should handle notes with no feedbackUrl', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_NOTES_RESPONSE_NO_FEEDBACK});
        webex.internal.encryption.decryptText.resolves('Short notes content.');

        const result = await webex.internal.aisummary.getNotes({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('notes-id-002');
        expect(result.content).to.equal('Short notes content.');
        expect(result.feedbackUrl).to.be.undefined;
      });

      it('should reject when containerInfo is missing notesUrl', async () => {
        await expect(
          webex.internal.aisummary.getNotes({
            containerInfo: {summaryData: {}, encryptionKeyUrl: MOCK_ENCRYPTION_KEY_URL},
          })
        ).to.be.rejectedWith(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });
    });

    // --------------------------------------------------------
    // getActionItems
    // --------------------------------------------------------
    describe('#getActionItems', () => {
      it('should fetch and decrypt all action item snippets', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_ACTION_ITEMS_RESPONSE});
        webex.internal.encryption.decryptText
          .onFirstCall()
          .resolves('Follow up with the client by Friday')
          .onSecondCall()
          .resolves('Send the proposal draft to the team');

        const result = await webex.internal.aisummary.getActionItems({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('action-items-id-001');
        expect(result.snippets).to.have.lengthOf(2);

        expect(result.snippets[0].id).to.equal('snippet-001');
        expect(result.snippets[0].aiGeneratedContent).to.equal(
          'Follow up with the client by Friday'
        );
        expect(result.snippets[0].editedContent).to.equal('User edited version of item 1');

        expect(result.snippets[1].id).to.equal('snippet-002');
        expect(result.snippets[1].aiGeneratedContent).to.equal(
          'Send the proposal draft to the team'
        );
        expect(result.snippets[1].editedContent).to.be.undefined;

        expect(result.feedbackUrl).to.equal(MOCK_ACTION_ITEMS_RESPONSE[0].feedbackUrl);

        const callArgs = webex.request.getCall(0).args[0];
        expect(callArgs.uri).to.equal(MOCK_CONTAINER_RESPONSE.summaryData.actionItemsUrl);

        expect(webex.internal.encryption.decryptText.calledTwice).to.be.true;
      });

      it('should handle action items response as non-array object', async () => {
        const nonArrayResponse = {
          id: 'action-items-id-003',
          keyUrl: MOCK_ENCRYPTION_KEY_URL,
          snippets: [{id: 'snippet-010', aiGeneratedContent: 'encrypted-single'}],
        };

        webex.request = sinon.stub().resolves({body: nonArrayResponse});
        webex.internal.encryption.decryptText.resolves('Single action item');

        const result = await webex.internal.aisummary.getActionItems({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('action-items-id-003');
        expect(result.snippets).to.have.lengthOf(1);
        expect(result.snippets[0].aiGeneratedContent).to.equal('Single action item');
      });

      it('should handle empty snippets array', async () => {
        webex.request = sinon.stub().resolves({body: MOCK_ACTION_ITEMS_EMPTY_SNIPPETS});

        const result = await webex.internal.aisummary.getActionItems({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(result.id).to.equal('action-items-id-002');
        expect(result.snippets).to.have.lengthOf(0);
        expect(webex.internal.encryption.decryptText.called).to.be.false;
      });

      it('should reject when containerInfo is missing actionItemsUrl', async () => {
        await expect(
          webex.internal.aisummary.getActionItems({
            containerInfo: {summaryData: {}, encryptionKeyUrl: MOCK_ENCRYPTION_KEY_URL},
          })
        ).to.be.rejectedWith(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });
    });

    // --------------------------------------------------------
    // getTranscriptUrl
    // --------------------------------------------------------
    describe('#getTranscriptUrl', () => {
      it('should return the transcript URL from container info', () => {
        const url = webex.internal.aisummary.getTranscriptUrl({
          containerInfo: MOCK_CONTAINER_RESPONSE,
        });

        expect(url).to.equal(MOCK_CONTAINER_RESPONSE.summaryData.transcriptUrl);
      });

      it('should throw when containerInfo is missing transcriptUrl', () => {
        expect(() =>
          webex.internal.aisummary.getTranscriptUrl({
            containerInfo: {summaryData: {}, encryptionKeyUrl: MOCK_ENCRYPTION_KEY_URL},
          })
        ).to.throw(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });

      it('should throw when containerInfo is missing encryptionKeyUrl', () => {
        expect(() =>
          webex.internal.aisummary.getTranscriptUrl({
            containerInfo: {
              summaryData: {transcriptUrl: 'https://some-url'},
              encryptionKeyUrl: undefined,
            },
          })
        ).to.throw(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
      });
    });

    // --------------------------------------------------------
    // _handleError
    // --------------------------------------------------------
    describe('#_handleError', () => {
      it('should map 404 to CONTAINER_NOT_FOUND', () => {
        const err = webex.internal.aisummary._handleError(
          {statusCode: 404},
          'testMethod'
        );
        expect(err.message).to.equal(ERROR_MESSAGES.CONTAINER_NOT_FOUND);
      });

      it('should map 403 to ACCESS_DENIED', () => {
        const err = webex.internal.aisummary._handleError(
          {statusCode: 403},
          'testMethod'
        );
        expect(err.message).to.equal(ERROR_MESSAGES.ACCESS_DENIED);
      });

      it('should map 401 to AUTHENTICATION_FAILED', () => {
        const err = webex.internal.aisummary._handleError(
          {statusCode: 401},
          'testMethod'
        );
        expect(err.message).to.equal(ERROR_MESSAGES.AUTHENTICATION_FAILED);
      });

      it('should include method name and message for unknown errors', () => {
        const err = webex.internal.aisummary._handleError(
          {statusCode: 500, message: 'Internal Server Error'},
          'getSummary'
        );
        expect(err.message).to.equal('getSummary failed: Internal Server Error');
      });

      it('should handle errors with no message', () => {
        const err = webex.internal.aisummary._handleError({statusCode: 502}, 'getNotes');
        expect(err.message).to.equal('getNotes failed: Unknown error');
      });
    });
  });
});
