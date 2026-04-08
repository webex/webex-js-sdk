import {env} from 'process';
import * as path from 'path';

require('dotenv').config({path: path.resolve(__dirname, '.env')});

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
  SET_6: {
    AGENTS: {
      AGENT1: {username: 'user17', extension: '1017', agentName: 'User17 Agent17'},
      AGENT2: {username: 'user18', extension: '1018', agentName: 'User18 Agent18'},
    },
    QUEUE_NAME: 'Queue e2e 6',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-6.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e6@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT6,
    TEST_SUITE: 'dial-number-tests.spec.ts',
  },
  SET_7: {
    AGENTS: {
      AGENT1: {username: 'user25', extension: '1025', agentName: 'User25 Agent25'},
      AGENT2: {username: 'user26', extension: '1026', agentName: 'User26 Agent26'},
      AGENT3: {username: 'user27', extension: '1027', agentName: 'User27 Agent27'},
      AGENT4: {username: 'user28', extension: '1028', agentName: 'User28 Agent28'},
    },
    QUEUE_NAME: 'Queue e2e 7',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-7.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e7@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT7,
    TEST_SUITE: 'multiparty-conference-set-7-tests.spec.ts',
  },
  SET_8: {
    AGENTS: {
      AGENT1: {username: 'user29', extension: '1029', agentName: 'User29 Agent29'},
      AGENT2: {username: 'user30', extension: '1030', agentName: 'User30 Agent30'},
      AGENT3: {username: 'user31', extension: '1031', agentName: 'User31 Agent31'},
      AGENT4: {username: 'user32', extension: '1032', agentName: 'User32 Agent32'},
    },
    QUEUE_NAME: 'Queue e2e 8',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-8.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e8@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT8,
    TEST_SUITE: 'multiparty-conference-set-8-tests.spec.ts',
  },
  SET_9: {
    AGENTS: {
      AGENT1: {username: 'user33', extension: '1033', agentName: 'User33 Agent33'},
      AGENT2: {username: 'user34', extension: '1034', agentName: 'User34 Agent34'},
      AGENT3: {username: 'user35', extension: '1035', agentName: 'User35 Agent35'},
      AGENT4: {username: 'user36', extension: '1036', agentName: 'User36 Agent36'},
    },
    QUEUE_NAME: 'Queue e2e 9',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-9.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e9@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT9,
    TEST_SUITE: 'multiparty-conference-set-9-tests.spec.ts',
  },
};
