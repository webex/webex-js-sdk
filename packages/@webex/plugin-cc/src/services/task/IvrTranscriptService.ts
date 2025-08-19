import {WebexSDK, HTTP_METHODS, WebexRequestPayload} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {IvrTranscriptMetaDataResponse, IvrTranscriptResponse, IvrTranscriptData} from './types';

/**
 * IVR Transcript Service for managing IVR transcript operations
 * Provides functionality to fetch IVR transcript metadata and conversation content
 * using WebEx request infrastructure to handle CORS and authentication
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
   * Fetches IVR transcript metadata for a given interaction
   * This provides information about available transcript paths and metadata
   *
   * @param orgId - Organization ID for the request
   * @param interactionId - Unique interaction identifier
   * @param timeOutMins - Timeout in minutes for the request (default: 10)
   * @returns Promise<IvrTranscriptMetaDataResponse> Metadata about available transcripts
   * @throws Error if the metadata request fails
   *
   * @example
   * ```typescript
   * const metadata = await ivrService.getIvrTranscriptMetadata(
   *   'orgId123',
   *   'interaction456',
   *   15
   * );
   * console.log('Available transcripts:', metadata.transcripts.length);
   * ```
   */
  public async getIvrTranscriptMetadata(
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
      // const authToken = await this.webex.credentials.getUserToken();
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

      LoggerProxy.log('IVR transcript metadata fetched successfully', {
        module: 'IvrTranscriptService',
        method: 'getIvrTranscriptMetadata',
        interactionId,
      });

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
   * Fetches the actual IVR conversation transcript content from a transcript path
   * Uses WebEx request infrastructure to bypass CORS restrictions
   *
   * @param transcriptPath - Full URL path to the transcript content
   * @returns Promise<IvrTranscriptResponse> The conversation transcript data
   * @throws Error if the conversation request fails
   *
   * @example
   * ```typescript
   * const conversation = await ivrService.fetchIvrConversation(
   *   'https://mediastorage.../transcript.json'
   * );
   * console.log('Conversation turns:', conversation.length);
   * ```
   */
  public async fetchIvrConversation(transcriptPath: string): Promise<IvrTranscriptResponse> {
    LoggerProxy.info('Fetching IVR conversation content', {
      module: 'IvrTranscriptService',
      method: 'fetchIvrConversation',
    });

    try {
      // const authToken = await this.webex.credentials.getUserToken();
      const requestPayload: WebexRequestPayload = {
        uri: transcriptPath,
        method: HTTP_METHODS.GET,
        // headers: {
        //   Authorization: `Bearer ${authToken}`,
        // },
      };

      const response = (await this.webex.request(requestPayload)) as WebexRequestPayload;

      // Handle the response based on its structure
      let conversationData: IvrTranscriptResponse;

      if (response.body && typeof response.body === 'object') {
        // If response has a conversation property, extract it
        if ('conversation' in response.body) {
          conversationData = (response.body as IvrTranscriptData).conversation;
        } else {
          // Otherwise assume the body is the conversation array
          conversationData = response.body as IvrTranscriptResponse;
        }
      } else {
        // Empty response case
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
   * Flattens the parameters object recursively (matching agent desktop logic)
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
        const finalKey = paramKey ? `${paramKey} ${key}` : key;

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
   * Parses conversations and flattens bot parameters (matching agent desktop logic)
   * @private
   */
  private parseConversations = (
    conversation: IvrTranscriptResponse,
    botName: string
  ): IvrTranscriptResponse => {
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
   * Fetches IVR transcript following the exact agent desktop logic
   * This matches the agent desktop implementation exactly
   *
   * @param orgId - Organization ID
   * @param interactionId - Unique interaction identifier
   * @param timeOutMins - Timeout in minutes for the request (default: 10)
   * @returns Promise<IvrTranscriptResponse> Complete conversation transcript
   * @throws Error if any step of the process fails
   *
   * @example
   * ```typescript
   * const transcript = await ivrService.fetchIVRTranscript(
   *   'orgId123',
   *   'interaction456'
   * );
   * console.log('Parsed transcript:', transcript);
   * ```
   */
  public async fetchIVRTranscript(
    orgId: string,
    interactionId: string,
    timeOutMins = 10
  ): Promise<IvrTranscriptResponse> {
    LoggerProxy.info('Fetching IVR transcript using agent desktop logic', {
      module: 'IvrTranscriptService',
      method: 'fetchIVRTranscript',
      interactionId,
    });

    try {
      // Step 1: Fetch metadata (same as agent desktop fetchMetaData)
      const metaData = await this.getIvrTranscriptMetadata(orgId, interactionId, timeOutMins);
      LoggerProxy.log(
        `Retrieved IVR metadata with transcript count: ${metaData.transcripts?.length || 0}`,
        {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
        }
      );

      // Step 2: Initialize transcript conversations array
      let transcriptConversations: IvrTranscriptResponse = [];
      const transcriptMetaDataList = metaData.transcripts;

      // Step 3: Check if transcripts are available
      if (!transcriptMetaDataList || transcriptMetaDataList.length === 0) {
        LoggerProxy.warn('No IVR transcripts found for interaction', {
          module: 'IvrTranscriptService',
          method: 'fetchIVRTranscript',
          interactionId,
        });

        return transcriptConversations;
      }

      // Step 4: Process ALL transcripts sequentially (matching agent desktop logic)
      // eslint-disable-next-line no-await-in-loop
      for (const transcriptMetaData of transcriptMetaDataList) {
        try {
          LoggerProxy.log(`Processing transcript: ${transcriptMetaData.transcriptId}`, {
            module: 'IvrTranscriptService',
            method: 'fetchIVRTranscript',
            interactionId,
          });

          // Fetch conversation for this transcript
          // eslint-disable-next-line no-await-in-loop
          let conversation = await this.fetchIvrConversation(transcriptMetaData.transcriptPath);

          // Parse conversations with bot name (matching agent desktop parseConversations)
          conversation = this.parseConversations(conversation, transcriptMetaData.botName);

          // Concatenate to main conversations array (matching agent desktop logic)
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
          // Continue processing other transcripts even if one fails
        }
      }

      LoggerProxy.log(
        `IVR transcript fetched and parsed successfully with length: ${transcriptConversations.length}`,
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
