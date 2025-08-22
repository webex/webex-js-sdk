import {WebexSDK, HTTP_METHODS, WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {IvrTranscriptMetaDataResponse, IvrTranscriptResponse, IvrTranscriptData} from './types';

/**
 * Service for retrieving IVR (Interactive Voice Response) transcript data
 * Handles fetching transcript metadata and conversation content from storage endpoints
 * Provides structured access to bot conversation history and customer interactions
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
   * Retrieves metadata about available IVR transcripts for a specific interaction
   * Returns information about transcript locations, bot names, and timing data
   *
   * @param orgId - Organization identifier
   * @param interactionId - Unique identifier for the customer interaction
   * @param timeOutMins - Request timeout duration in minutes (default: 10)
   * @returns Promise containing transcript metadata including file paths and bot information
   * @throws Error when metadata retrieval fails due to network, authentication, or server issues
   *
   * @example
   * ```typescript
   * const metadata = await service.getIvrTranscriptMetadata('org123', 'interaction456', 15);
   * console.log('Available transcripts:', metadata.transcripts.length);
   * console.log('First transcript path:', metadata.transcripts[0]?.transcriptPath);
   * ```
   */
  private async getIvrTranscriptMetadata(
    orgId: string,
    interactionId: string,
    timeOutMins = 10
  ): Promise<IvrTranscriptMetaDataResponse> {
    LoggerProxy.info('Fetching IVR transcript metadata', {
      module: 'IvrTranscriptService',
      method: 'getIvrTranscriptMetadata',
      interactionId,
    });

    try {
      const requestPayload: WebexRequestPayload = {
        uri: `https://mediastorage.produs1.ciscoccservice.com/media/organization/${orgId}/interaction/${interactionId}/ivrtranscript?timeOutMins=${timeOutMins}`,
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
      LoggerProxy.error(`Failed to fetch IVR transcript metadata: ${error}`, {
        module: 'IvrTranscriptService',
        method: 'getIvrTranscriptMetadata',
        interactionId,
      });
      throw error;
    }
  }

  /**
   * Retrieves the actual conversation content from a transcript file URL
   * Downloads and parses the transcript data containing bot responses and customer interactions
   *
   * @param transcriptPath - Complete URL to the transcript file in cloud storage
   * @returns Promise containing the conversation transcript as an array of interaction turns
   * @throws Error when file download fails, content is malformed, or network issues occur
   *
   * @example
   * ```typescript
   * const conversation = await service.fetchIvrConversation(
   *   'https://storage.example.com/transcript123.json'
   * );
   * console.log('Conversation turns:', conversation.length);
   * console.log('First bot response:', conversation[0]?.bot?.reply);
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

      let conversationData: IvrTranscriptResponse;

      if (response.body && typeof response.body === 'object') {
        if ('conversation' in response.body) {
          conversationData = (response.body as IvrTranscriptData).conversation;
        } else {
          conversationData = response.body as IvrTranscriptResponse;
        }
      } else {
        conversationData = [];
      }

      LoggerProxy.log('IVR conversation content fetched successfully', {
        module: 'IvrTranscriptService',
        method: 'fetchIvrConversation',
      });

      return conversationData;
    } catch (error) {
      LoggerProxy.error(`Failed to fetch IVR conversation content: ${error}`, {
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
      params.forEach((param) => {
        if (param && typeof param === 'object') {
          flatParams = {...flatParams, ...this.getFlatParams(param, paramKey)};
        } else {
          flatParams[paramKey] = param;
        }
      });
    } else {
      Object.keys(params).forEach((key) => {
        const finalKey = paramKey ? `${paramKey}.${key}` : key;
        if (params[key] && typeof params[key] === 'object') {
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
   * @param orgId - Organization identifier
   * @param interactionId - Unique identifier for the customer interaction
   * @param timeOutMins - Request timeout duration in minutes (default: 10)
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
    timeOutMins = 10
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
        } catch (error) {
          LoggerProxy.warn(
            `Failed to process transcript ${transcriptMetaData.transcriptId}: ${error}`,
            {
              module: 'IvrTranscriptService',
              method: 'fetchIVRTranscript',
              interactionId,
            }
          );
          // Continue processing remaining transcripts even if individual files fail
        }
      }

      LoggerProxy.log(
        `Complete IVR transcript processing finished - total conversation turns: ${transcriptConversations.length}`,
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
