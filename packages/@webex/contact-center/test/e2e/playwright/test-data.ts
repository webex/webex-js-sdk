import {env} from 'process';

require('dotenv').config();

export const USER_SETS = {
  SET_1: {
    AGENTS: {
      AGENT1: {username: 'user15', extension: '1015', agentName: 'User15 Agent15'},
      AGENT2: {username: 'user16', extension: '1016', agentName: 'User16 Agent16'},
    },
    QUEUE_NAME: 'Queue e2e 1',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT1,
    TEST_SUITE: 'digital-incoming-task-tests.spec.ts',
  },
  SET_2: {
    AGENTS: {
      AGENT1: {username: 'user13', extension: '1013', agentName: 'User13 Agent13'},
      AGENT2: {username: 'user14', extension: '1014', agentName: 'User14 Agent14'},
    },
    QUEUE_NAME: 'Queue e2e 2',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-2.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e2@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT2,
    TEST_SUITE: 'task-list-multi-session-tests.spec.ts',
  },
  SET_3: {
    AGENTS: {
      AGENT1: {username: 'user19', extension: '1019', agentName: 'User19 Agent19'},
      AGENT2: {username: 'user20', extension: '1020', agentName: 'User20 Agent20'},
    },
    QUEUE_NAME: 'Queue e2e 3',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-3.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e3@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT3,
    TEST_SUITE: 'station-login-user-state-tests.spec.ts',
  },
  SET_4: {
    AGENTS: {
      AGENT1: {username: 'user21', extension: '1021', agentName: 'User21 Agent21'},
      AGENT2: {username: 'user22', extension: '1022', agentName: 'User22 Agent22'},
    },
    QUEUE_NAME: 'Queue e2e 4',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-4.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e4@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT4,
    TEST_SUITE: 'basic-advanced-task-controls-tests.spec.ts',
  },
  SET_5: {
    AGENTS: {
      AGENT1: {username: 'user23', extension: '1023', agentName: 'User23 Agent23'},
      AGENT2: {username: 'user24', extension: '1024', agentName: 'User24 Agent24'},
    },
    QUEUE_NAME: 'Queue e2e 5',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-5.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e5@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT5,
    TEST_SUITE: 'advanced-task-controls-tests.spec.ts',
  },
};
