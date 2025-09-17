import {WebexSDK, HTTP_METHODS, WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {IvrTranscriptMetaDataResponse, IvrTranscriptResponse, IvrTranscriptData} from './types';
import {IVR_TRANSCRIPT_API_BASE_URL} from '../constants';

/**
 * Service for retrieving complete IVR conversation transcripts for customer interactions
 *
 * Retrieves conversation history between customers and IVR bots by:
 * - Fetching transcript metadata to discover available conversation files
 * - Downloading actual conversation content from cloud storage endpoints
 * - Processing and enriching transcript data with bot identification
 * - Flattening complex nested parameters into accessible key-value pairs
 * - Combining multiple bot interactions into a unified conversation history
 */
export class IvrTranscriptService {
  private webex: WebexSDK;

  /**
   * Creates an instance of IvrTranscriptService
   * @param webex - The WebexSDK instance for making requests
   */
  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  /**
   * Fetches metadata for all IVR transcript files associated with a customer interaction
   *
   * Queries the media storage service to discover what IVR conversations are available
   * for download. Returns essential information needed to retrieve the actual transcript
   * content including file locations, bot identifiers, and session timing details.
   *
   * @param orgId - Organization identifier for multi-tenant security and resource isolation
   * @param interactionId - Unique identifier linking the customer's current call to their IVR session history
   * @param timeOutMins - TTL (Time To Live) for conversation availability in storage, max wait time for transcript processing (default: 5)
   * @returns Promise resolving to metadata containing transcript file paths and bot information
   * @throws Error when metadata retrieval fails due to network, authentication, or server issues
   *
   * @example
   * ```typescript
   * // Discover available IVR transcripts for a customer interaction
   * const metadata = await service.getIvrTranscriptMetadata('org123', 'interaction456', 15);
   * console.log(`Found ${metadata.transcripts.length} IVR conversations`);
   * metadata.transcripts.forEach(transcript => {
   *   console.log(`Bot: ${transcript.botName}, File: ${transcript.transcriptPath}`);
   * });
   * ```
   */
  private async getIvrTranscriptMetadata(
    orgId: string,
    interactionId: string,
    timeOutMins = 5
  ): Promise<IvrTranscriptMetaDataResponse> {
    LoggerProxy.info('Fetching IVR transcript metadata', {
      module: 'IvrTranscriptService',
      method: 'getIvrTranscriptMetadata',
      interactionId,
    });

    try {
      const requestPayload: WebexRequestPayload = {
        uri: `${IVR_TRANSCRIPT_API_BASE_URL}/${orgId}/interaction/${interactionId}/ivrtranscript?timeOutMins=${timeOutMins}`,
        method: HTTP_METHODS.GET,
        headers: {
          'cisco-no-http-redirect': null,
          'spark-user-agent': null,
          Authorization: await this.webex.credentials.getUserToken(),
        },
      };

      const response = (await this.webex.request(requestPayload)) as WebexRequestPayload;

      return response.body as IvrTranscriptMetaDataResponse;
    } catch (error) {
      const statusCode =
        (error as any)?.statusCode || (error as any)?.response?.status || 'unknown';
      const errorMessage = `Failed to fetch IVR transcript metadata${
        statusCode !== 'unknown' ? ` (Status: ${statusCode})` : ''
      }: ${error}`;

      LoggerProxy.error(errorMessage, {
        module: 'IvrTranscriptService',
        method: 'getIvrTranscriptMetadata',
        interactionId,
      });
      throw error;
    }
  }

  /**
   * Downloads and processes actual customer-bot conversation content from cloud storage
   *
   * Retrieves transcript files containing conversation exchanges between customers and IVR bots.
   * The API consistently returns data in wrapped format { conversation: [...] } which is extracted
   * and returned as a clean array of conversation turns.
   *
   * @param transcriptPath - Complete URL to the transcript file in cloud storage
   * @returns Promise containing the conversation transcript as an array of interaction turns
   * @throws Error when file download fails, content is malformed, or network issues occur
   *
   * @example
   * ```typescript
   * // Download conversation content from transcript file
   * const conversation = await service.fetchIvrConversation(
   *   'https://storage.cisco.com/transcript123.json'
   * );
   * console.log(`Conversation had ${conversation.length} exchanges`);
   * conversation.forEach(turn => {
   *   console.log(`Customer: ${turn.customer?.query}`);
   *   console.log(`Bot: ${turn.bot?.reply}`);
   * });
   * ```
   */
  private async fetchIvrConversation(transcriptPath: string): Promise<IvrTranscriptResponse> {
    LoggerProxy.info('Fetching IVR conversation content', {
      module: 'IvrTranscriptService',
      method: 'fetchIvrConversation',
    });

    try {
      const requestPayload: WebexRequestPayload = {
        uri: transcriptPath,
        method: HTTP_METHODS.GET,
      };

      const response = (await this.webex.request(requestPayload)) as WebexRequestPayload;

      // Extract conversation data from the wrapped response format
      const conversationData: IvrTranscriptResponse =
        (response.body as IvrTranscriptData)?.conversation || [];

      LoggerProxy.log('IVR conversation content fetched successfully', {
        module: 'IvrTranscriptService',
        method: 'fetchIvrConversation',
      });

      return conversationData;
    } catch (error) {
      const statusCode =
        (error as any)?.statusCode || (error as any)?.response?.status || 'unknown';
      const errorMessage = `Failed to fetch IVR conversation content${
        statusCode !== 'unknown' ? ` (Status: ${statusCode})` : ''
      }: ${error}`;

      LoggerProxy.error(errorMessage, {
        module: 'IvrTranscriptService',
        method: 'fetchIvrConversation',
      });
      throw error;
    }
  }

  /**
   * Recursively flattens nested parameter objects into dot-notation keys
   * Converts complex nested structures into a flat key-value mapping for easier processing
   * @param params - The parameter object or array to flatten
   * @param paramKey - The current key prefix for nested properties
   * @returns Flattened object with dot-notation keys
   * @private
   */
  private getFlatParams = (params: any, paramKey: string): Record<string, any> => {
    let flatParams: Record<string, any> = {};

    if (Array.isArray(params)) {
      params.forEach((param, index) => {
        const arrayKey = paramKey ? `${paramKey}[${index}]` : `[${index}]`;
        if (param && typeof param === 'object') {
          flatParams = {...flatParams, ...this.getFlatParams(param, arrayKey)};
        } else {
          flatParams[arrayKey] = param;
        }
      });
    } else if (params && typeof params === 'object') {
      Object.keys(params).forEach((key) => {
        const finalKey = paramKey ? `${paramKey}.${key}` : key;
        if (params[key] && typeof params[key] === 'object' && !Array.isArray(params[key])) {
          flatParams = {...flatParams, ...this.getFlatParams(params[key], finalKey)};
        } else if (Array.isArray(params[key])) {
          flatParams = {...flatParams, ...this.getFlatParams(params[key], finalKey)};
        } else {
          flatParams[finalKey] = params[key];
        }
      });
    }

    return flatParams;
  };

  /**
   * Processes conversation data by adding bot name and flattening parameter structures
   * Enriches transcript data with bot identification and standardizes parameter format
   * @param conversation - Array of conversation turns to process
   * @param botName - Name of the bot to associate with responses
   * @returns Processed conversation array with enhanced bot information
   * @private
   */
  private parseConversations = (conversation: IvrTranscriptResponse, botName: string) => {
    conversation.forEach((transcript, index) => {
      if (transcript.bot) {
        transcript.bot.botName = botName;
        if (transcript.bot.parameters) {
          transcript.bot.parameters = this.getFlatParams(transcript.bot.parameters, '');
        }
        conversation[index] = transcript;
      }
    });

    return conversation;
  };

  /**
   * Retrieves complete IVR transcript data by fetching metadata and all conversation content
   * Orchestrates the full transcript retrieval process including error handling for partial failures
   *
   * @param orgId - Organization identifier for multi-tenant security and resource isolation
   * @param interactionId - Unique identifier linking the customer's current call to their IVR session history
   * @param timeOutMins - TTL (Time To Live) for conversation availability in storage, max wait time for transcript processing (default: 5)
   * @returns Promise containing all conversation turns from available transcripts
   * @throws Error when metadata retrieval fails or all transcript downloads fail
   *
   * @example
   * ```typescript
   * const fullTranscript = await service.fetchIVRTranscript('org123', 'interaction456');
   * console.log('Total conversation turns:', fullTranscript.length);
   * fullTranscript.forEach(turn => {
   *   if (turn.bot) console.log('Bot:', turn.bot.reply);
   *   if (turn.customer) console.log('Customer:', turn.customer.query);
   * });
   * ```
   */
  public async fetchIVRTranscript(
    orgId: string,
    interactionId: string,
    timeOutMins = 5
  ): Promise<IvrTranscriptResponse> {
    LoggerProxy.info('Fetching complete IVR transcript with metadata and conversations', {
      module: 'IvrTranscriptService',
      method: 'fetchIVRTranscript',
      interactionId,
    });

    try {
      // Step 1: Retrieve transcript metadata to get file locations and bot information
      const metaData = await this.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      LoggerProxy.log(
        `Retrieved transcript metadata containing ${
          metaData.transcripts?.length || 0
        } transcript files`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
        }
      );

      // Step 2: Initialize conversation collection array
      let transcriptConversations: IvrTranscriptResponse = [];
      const transcriptMetaDataList = metaData.transcripts;

      // Step 3: Validate transcript availability
      if (!transcriptMetaDataList || transcriptMetaDataList.length === 0) {
        LoggerProxy.warn('No IVR transcripts found for interaction', {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId,
        });

        return transcriptConversations;
      }

      // Step 4: Process each transcript file sequentially to build complete conversation history
      let successCount = 0;
      let failureCount = 0;

      // eslint-disable-next-line no-await-in-loop
      for (const transcriptMetaData of transcriptMetaDataList) {
        try {
          LoggerProxy.log(`Processing transcript file: ${transcriptMetaData.transcriptId}`, {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          });
          // eslint-disable-next-line no-await-in-loop
          let conversation = await this.fetchIvrConversation(transcriptMetaData.transcriptPath);
          conversation = this.parseConversations(conversation, transcriptMetaData.botName);
          transcriptConversations = transcriptConversations.concat(conversation);
          successCount += 1;
        } catch (error) {
          failureCount += 1;
          const statusCode =
            (error as any)?.statusCode || (error as any)?.response?.status || 'unknown';
          const errorMessage = `Failed to process transcript ${transcriptMetaData.transcriptId}${
            statusCode !== 'unknown' ? ` (Status: ${statusCode})` : ''
          }: ${error}`;

          LoggerProxy.warn(errorMessage, {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          });
          // Continue processing remaining transcripts even if individual files fail
        }
      }

      const totalTranscripts = transcriptMetaDataList.length;
      LoggerProxy.log(
        `Transcript processing summary: ${successCount}/${totalTranscripts} transcripts processed successfully${
          failureCount > 0 ? `, ${failureCount} failed` : ''
        }`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId,
        }
      );

      LoggerProxy.log(
        `IVR transcript processing completed - ${successCount}/${totalTranscripts} files processed, ${transcriptConversations.length} total conversation turns`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId,
        }
      );

      return transcriptConversations;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch IVR transcript: ${error}`, {
        module: 'IvrTranscriptService',
        method: 'fetchIVRTranscript',
        interactionId,
      });
      throw error;
    }
  }
}

export default IvrTranscriptService;
