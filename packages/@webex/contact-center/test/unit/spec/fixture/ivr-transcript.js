export default {
  // Mock metadata for IVR transcript
  mockOrgId: 'org123',
  mockInteractionId: 'interaction456',
  mockTimeOutMins: 5,
  mockTranscriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript.json',
  mockNonS3TranscriptPath: 'https://example.com/transcript.json',

  // Mock transcript metadata (matching real API structure)
  mockTranscriptMetadata: {
    orgId: 'org123',
    transcriptId: 'trans1',
    transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript.json',
    cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
    startTime: 1756475633245,
    stopTime: 1756475688632,
    botName: 'TestBot',
  },

  // Mock metadata response from API
  mockMetadataResponse: {
    orgId: 'org123',
    interactionId: 'interaction456',
    timeOutMins: 5,
    transcripts: [
      {
        transcriptId: 'trans1',
        transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 123,
        stopTime: 456,
        botName: 'TestBot',
      }
    ],
  },

  // Mock multiple transcripts metadata for testing
  mockMultipleTranscriptsMetadata: {
    orgId: 'org123',
    interactionId: 'interaction456',
    timeOutMins: 5,
    transcripts: [
      {
        transcriptId: 'trans1',
        transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 123,
        stopTime: 456,
        botName: 'TestBot',
      },
      {
        transcriptId: 'trans2',
        transcriptPath: 'https://example.com/transcript2.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 200,
        stopTime: 300,
        botName: 'Bot2',
      },
      {
        transcriptId: 'trans3',
        transcriptPath: 'https://example.com/transcript3.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 400,
        stopTime: 500,
        botName: 'Bot3',
      }
    ],
  },

  // Mock 3 transcripts for failure scenario testing  
  mockThreeTranscriptsMetadata: {
    orgId: 'org123',
    interactionId: 'interaction456',
    timeOutMins: 5,
    transcripts: [
      {
        orgId: 'org123',
        transcriptId: 'trans1',
        transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript1.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 1756475633245,
        stopTime: 1756475688632,
        botName: 'Bot1',
      },
      {
        orgId: 'org123',
        transcriptId: 'trans2',
        transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript2.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 1756475700000,
        stopTime: 1756475750000,
        botName: 'Bot2',
      },
      {
        orgId: 'org123',
        transcriptId: 'trans3',
        transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript3.json',
        cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
        startTime: 1756475800000,
        stopTime: 1756475850000,
        botName: 'Bot3',
      }
    ],
  },

  // Mock conversation turn
  mockConversationTurn: {
    bot: {
      reply: 'Hello',
      timestamp: 123,
      confidence: 0.9,
      parameters: { foo: 'bar' },
    },
    customer: {
      query: 'Hi',
      sentiment: 1,
      timestamp: 123,
    },
  },

  // Mock conversation response from S3
  mockConversationResponse: [
    {
      bot: {
        reply: 'Hello',
        timestamp: 123,
        confidence: 0.9,
        parameters: { foo: 'bar' },
      },
      customer: {
        query: 'Hi',
        sentiment: 1,
        timestamp: 123,
      },
    }
  ],

  // Mock conversation data for Task service tests
  mockConversationData: [
    {
      customer: {
        query: 'I need help with my account',
        sentiment: 0.8,
        timestamp: 1640995210000
      }
    },
    {
      bot: {
        timestamp: 1640995215000,
        confidence: 0.95,
        reply: 'I can help you with your account. What specifically do you need assistance with?',
        intentName: 'account_help',
        intentId: 'intent-123',
        botName: 'CustomerServiceBot'
      }
    }
  ],

  // Mock multiple transcript data for Task service tests
  mockMultipleTranscriptData: [
    {
      customer: { query: 'Hello', timestamp: 1000 }
    },
    {
      bot: { reply: 'Hi there', timestamp: 1001, botName: 'TestBot1' }
    },
    {
      customer: { query: 'Goodbye', timestamp: 2000 }
    },
    {
      bot: { reply: 'See you later', timestamp: 2001, botName: 'TestBot2' }
    }
  ],

  // Mock conversation turn with nested parameters for testing flattening
  mockConversationWithNestedParams: {
    bot: {
      reply: 'Hello',
      confidence: 0.9,
      timestamp: 123,
      parameters: {
        user: { name: 'John', age: 30 },
        session: { id: '123' },
      },
    },
    customer: { query: 'Hi', sentiment: 1, timestamp: 123 },
  },

  // Mock conversation turn with array parameters for testing flattening
  mockConversationWithArrayParams: {
    bot: {
      reply: 'Hello',
      confidence: 0.9,
      timestamp: 123,
      parameters: [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ],
    },
    customer: { query: 'Hi', sentiment: 1, timestamp: 123 },
  },

  // Mock API responses for webex.request calls
  mockApiResponses: {
    metadataSuccess: {
      body: {
        orgId: 'org123',
        interactionId: 'interaction456',
        timeOutMins: 5,
        transcripts: [
          {
            transcriptId: 'trans1',
            transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 123,
            stopTime: 456,
            botName: 'TestBot',
          }
        ],
      }
    },
    conversationSuccess: {
      body: {
        conversation: [
          {
            bot: {
              reply: 'Hello',
              timestamp: 123,
              confidence: 0.9,
              parameters: { foo: 'bar' },
            },
            customer: {
              query: 'Hi',
              sentiment: 1,
              timestamp: 123,
            },
          }
        ]
      }
    },
    conversationSuccessBot1: {
      body: {
        conversation: [
          {
            bot: {
              reply: 'Hello! I am your virtual assistant. I can help you with billing, account, and technical support. Please select: 1.Billing 2.Account 3.Technical Support',
              timestamp: 1757945269131
            },
            customer: {}
          },
          {
            bot: {
              intentName: 'Billing Support',
              confidence: 0.95,
              reply: 'I can help you with your billing questions. Let me transfer you to our billing specialist.',
              parameters: { department: 'billing', priority: 'high' },
              timestamp: 1757945288413
            },
            customer: {
              confidence: 0.8,
              query: 'I need help with billing',
              timestamp: 1757945288413
            }
          }
        ]
      }
    },
    conversationSuccessBot2: {
      body: {
        conversation: [
          {
            bot: {
              reply: 'I can help you with account-related queries. Please tell me what you need assistance with.',
              timestamp: 1757945300000
            },
            customer: {}
          },
          {
            bot: {
              intentName: 'Account Support',
              confidence: 0.85,
              reply: 'Let me check your account details and connect you with our account specialist.',
              parameters: { department: 'account', action: 'lookup' },
              timestamp: 1757945320000
            },
            customer: {
              confidence: 0.6,
              query: 'What about my account?',
              timestamp: 1757945320000
            }
          }
        ]
      }
    },
    conversationSuccessBot3: {
      body: {
        conversation: [
          {
            bot: {
              reply: 'Technical support is available. I can help you with device setup, troubleshooting, and more.',
              timestamp: 1757945350000
            },
            customer: {}
          },
          {
            bot: {
              intentName: 'Technical Support Transfer',
              confidence: 0.92,
              reply: 'I will transfer you to technical support now. Please hold while I connect you.',
              parameters: { department: 'tech-support', action: 'transfer' },
              timestamp: 1757945370000
            },
            customer: {
              confidence: 0.7,
              query: 'Can you transfer me to technical support?',
              timestamp: 1757945370000
            }
          }
        ]
      }
    },
    conversationEmpty: {
      body: undefined
    },
    metadataEmpty: {
      body: {
        orgId: 'org123',
        interactionId: 'interaction456',
        timeOutMins: 5,
        transcripts: [],
      }
    },
    metadataThreeTranscripts: {
      body: {
        orgId: 'org123',
        interactionId: 'interaction456',
        timeOutMins: 5,
        transcripts: [
          {
            orgId: 'org123',
            transcriptId: 'trans1',
            transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript1.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 1756475633245,
            stopTime: 1756475688632,
            botName: 'Bot1',
          },
          {
            orgId: 'org123',
            transcriptId: 'trans2',
            transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript2.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 1756475700000,
            stopTime: 1756475750000,
            botName: 'Bot2',
          },
          {
            orgId: 'org123',
            transcriptId: 'trans3',
            transcriptPath: 'https://mediastorage.produs1.ciscoccservice.com/transcript3.json',
            cvaId: 'NATIVE_BASIC_VIRTUAL_AGENT',
            startTime: 1756475800000,
            stopTime: 1756475850000,
            botName: 'Bot3',
          }
        ],
      }
    }
  }
};
