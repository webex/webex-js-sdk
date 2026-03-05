/*!
 * Copyright (c) 2015-2025 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin} from '@webex/webex-core';

import {AI_SUMMARY_SERVICE, AI_SUMMARY_CONTAINERS_RESOURCE, ERROR_MESSAGES} from './constants';
import type {
  GetContainerOptions,
  GetSummaryContentOptions,
  PragyaContainerResponse,
  SummaryContent,
  SummaryNotes,
  SummaryActionItems,
} from './types';

const AISummary = WebexPlugin.extend({
  namespace: 'AISummary',

  /**
   * Resolve a Pragya container by ID.
   * Returns container metadata including summary URLs and encryption key.
   *
   * @param {GetContainerOptions} options
   * @returns {Promise<PragyaContainerResponse>}
   */
  getContainer(options: GetContainerOptions): Promise<PragyaContainerResponse> {
    const {containerId} = options;

    this._validateContainerId(containerId);

    return this.webex
      .request({
        method: 'GET',
        service: AI_SUMMARY_SERVICE,
        resource: `${AI_SUMMARY_CONTAINERS_RESOURCE}/${containerId}`,
      })
      .then(({body}) => {
        // Pragya API nests summary URLs under summaryData.data — flatten
        // so consumers can access summaryData.summaryUrl directly.
        if (body.summaryData?.data) {
          body.summaryData = body.summaryData.data;
        }

        return body;
      })
      .catch((error) => {
        this.logger.error('AISummary->getContainer failed', {error, containerId});
        throw this._handleError(error, 'getContainer');
      });
  },

  /**
   * Get AI-generated full summary for a call.
   * Fetches from containerInfo.summaryData.summaryUrl and decrypts content.
   *
   * @param {GetSummaryContentOptions} options
   * @returns {Promise<SummaryContent>}
   */
  async getSummary(options: GetSummaryContentOptions): Promise<SummaryContent> {
    const {containerInfo} = options;

    this._validateContainerInfo(containerInfo, 'summaryUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: `${containerInfo.summaryData.summaryUrl}?fields=note,shortnote,actionitems`,
      });

      const decryptedNote = await this._decryptContent(
        body.note.aiGeneratedContent,
        containerInfo.encryptionKeyUrl
      );

      const decryptedShortNote = await this._decryptContent(
        body.shortnote.aiGeneratedContent,
        containerInfo.encryptionKeyUrl
      );

      const decryptedSnippets = await Promise.all(
        (body.actionitems?.snippets || []).map(async (snippet: any) => {
          const decryptedAiContent = await this._decryptContent(
            snippet.aiGeneratedContent,
            containerInfo.encryptionKeyUrl
          );

          return {
            id: snippet.id,
            editedContent: snippet.content || undefined,
            aiGeneratedContent: decryptedAiContent,
          };
        })
      );

      // feedbackUrl may be in the links array as rel="feedback"
      const feedbackLink = (body.links || []).find((link: any) => link.rel === 'feedback');

      return {
        id: body.id,
        note: decryptedNote,
        shortNote: decryptedShortNote,
        actionItems: decryptedSnippets,
        feedbackUrl: feedbackLink?.href,
      };
    } catch (error) {
      this.logger.error('AISummary->getSummary failed', {error});
      throw this._handleError(error, 'getSummary');
    }
  },

  /**
   * Get AI-generated notes for a call.
   * Fetches from containerInfo.summaryData.notesUrl and decrypts content.
   *
   * @param {GetSummaryContentOptions} options
   * @returns {Promise<SummaryNotes>}
   */
  async getNotes(options: GetSummaryContentOptions): Promise<SummaryNotes> {
    const {containerInfo} = options;

    this._validateContainerInfo(containerInfo, 'notesUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: containerInfo.summaryData.notesUrl,
      });

      const decryptedContent = await this._decryptContent(
        body.aiGeneratedContent,
        containerInfo.encryptionKeyUrl
      );

      return {
        id: body.id,
        content: decryptedContent,
        feedbackUrl: body.feedbackUrl,
      };
    } catch (error) {
      this.logger.error('AISummary->getNotes failed', {error});
      throw this._handleError(error, 'getNotes');
    }
  },

  /**
   * Get AI-generated action items for a call.
   * Fetches from containerInfo.summaryData.actionItemsUrl and decrypts content.
   *
   * @param {GetSummaryContentOptions} options
   * @returns {Promise<SummaryActionItems>}
   */
  async getActionItems(options: GetSummaryContentOptions): Promise<SummaryActionItems> {
    const {containerInfo} = options;

    this._validateContainerInfo(containerInfo, 'actionItemsUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: containerInfo.summaryData.actionItemsUrl,
      });

      // Action items response is an array; take the first element
      const actionItemsData = Array.isArray(body) ? body[0] : body;

      const decryptedSnippets = await Promise.all(
        (actionItemsData.snippets || []).map(async (snippet: any) => {
          const decryptedAiContent = await this._decryptContent(
            snippet.aiGeneratedContent,
            containerInfo.encryptionKeyUrl
          );

          return {
            id: snippet.id,
            editedContent: snippet.content || undefined,
            aiGeneratedContent: decryptedAiContent,
          };
        })
      );

      return {
        id: actionItemsData.id,
        snippets: decryptedSnippets,
        feedbackUrl: actionItemsData.feedbackUrl,
      };
    } catch (error) {
      this.logger.error('AISummary->getActionItems failed', {error});
      throw this._handleError(error, 'getActionItems');
    }
  },

  /**
   * Get the transcript URL for a call.
   * Returns the URL string from the container info.
   *
   * @param {GetSummaryContentOptions} options
   * @returns {string}
   */
  getTranscriptUrl(options: GetSummaryContentOptions): string {
    const {containerInfo} = options;

    this._validateContainerInfo(containerInfo, 'transcriptUrl');

    return containerInfo.summaryData.transcriptUrl;
  },

  /**
   * Validate containerId parameter.
   * @param {string} containerId - The container ID to validate.
   * @returns {void}
   * @private
   */
  _validateContainerId(containerId: string): void {
    if (!containerId || typeof containerId !== 'string' || containerId.trim().length === 0) {
      throw new Error(ERROR_MESSAGES.INVALID_CONTAINER_ID);
    }
  },

  /**
   * Validate containerInfo has the required URL field and encryption key.
   * @param {PragyaContainerResponse} containerInfo - The container info to validate.
   * @param {string} urlField - The summaryData field name to check.
   * @returns {void}
   * @private
   */
  _validateContainerInfo(containerInfo: PragyaContainerResponse, urlField: string): void {
    if (!containerInfo?.summaryData?.[urlField] || !containerInfo?.encryptionKeyUrl) {
      throw new Error(ERROR_MESSAGES.INVALID_CONTAINER_INFO);
    }
  },

  /**
   * Decrypt encrypted content using KMS.
   * Delegates to the internal encryption plugin.
   * @param {string} encryptedContent - The encrypted text (JWE format).
   * @param {string} encryptionKeyUrl - KMS key URL.
   * @returns {Promise<string>} Decrypted plaintext.
   * @private
   */
  _decryptContent(encryptedContent: string, encryptionKeyUrl: string): Promise<string> {
    return this.webex.internal.encryption.decryptText(encryptionKeyUrl, encryptedContent);
  },

  /**
   * Handle and normalize errors.
   * @param {object} error - The error object from the request.
   * @param {string} methodName - The name of the calling method.
   * @returns {Error} A normalized Error instance.
   * @private
   */
  _handleError(error: any, methodName: string): Error {
    if (error.statusCode === 404) {
      return new Error(ERROR_MESSAGES.CONTAINER_NOT_FOUND);
    }

    if (error.statusCode === 403) {
      return new Error(ERROR_MESSAGES.ACCESS_DENIED);
    }

    if (error.statusCode === 401) {
      return new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    }

    return new Error(`${methodName} failed: ${error.message || 'Unknown error'}`);
  },
});

export default AISummary;
