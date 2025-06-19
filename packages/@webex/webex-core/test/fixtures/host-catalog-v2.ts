export const serviceHostmapV2 = {
  activeServices: {
    conversation: 'urn:TEAM:us-east-2_a:conversation',
    idbroker: 'urn:TEAM:us-east-2_a:idbroker',
    locus: 'urn:TEAM:us-east-2_a:locus',
    mercury: 'urn:TEAM:us-east-2_a:mercury',
  },
  services: [
    {
      id: 'urn:TEAM:us-east-2_a:conversation',
      serviceName: 'conversation',
      serviceUrls: [
        {
          baseUrl: 'https://prod-achm-message.svc.webex.com/conversation/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://conv-a.wbx2.com/conversation/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:me-central-1_d:conversation',
      serviceName: 'conversation',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/conversation/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://conv-d.wbx2.com/conversation/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:us-east-2_a:idbroker',
      serviceName: 'idbroker',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/idbroker/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://idbroker.webex.com/idb/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:me-central-1_d:idbroker',
      serviceName: 'idbroker',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/idbroker/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://conv-d.wbx2.com/idbroker/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:us-east-2_a:locus',
      serviceName: 'locus',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/locus/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://locus-a.wbx2.com/locus/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:me-central-1_d:locus',
      serviceName: 'locus',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/locus/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://conv-d.wbx2.com/locus/api/v1',
          priority: 2,
        },
      ],
    },
    {
      id: 'urn:TEAM:us-east-2_a:mercury',
      serviceName: 'mercury',
      serviceUrls: [
        {
          baseUrl: 'https://mercury-a.wbx2.com/mercury/api/v1',
          priority: 1,
        },
      ],
    },
    {
      id: 'urn:TEAM:me-central-1_d:mercury',
      serviceName: 'mercury',
      serviceUrls: [
        {
          baseUrl: 'https://prod-adxb-message.svc.webex.com/mercury/api/v1',
          priority: 1,
        },
        {
          baseUrl: 'https://conv-d.wbx2.com/mercury/api/v1',
          priority: 2,
        },
      ],
    },
  ],
  orgId: '3e0e410f-f83f-4ee4-ac32-12692e99355c',
  timestamp: '1745533341',
  format: 'U2Cv2',
};

export const formattedServiceHostmapEntryConv = {
  id: 'urn:TEAM:us-east-2_a:conversation',
  serviceName: 'conversation',
  serviceUrls: [
    {
      baseUrl: 'https://prod-achm-message.svc.webex.com/conversation/api/v1',
      host: 'prod-achm-message.svc.webex.com',
      priority: 1,
    },
    {
      baseUrl: 'https://conv-a.wbx2.com/conversation/api/v1',
      host: 'conv-a.wbx2.com',
      priority: 2,
    },
  ],
};

export const formattedServiceHostmapV2 = [
  formattedServiceHostmapEntryConv,
  {
    id: 'urn:TEAM:me-central-1_d:conversation',
    serviceName: 'conversation',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/conversation/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://conv-d.wbx2.com/conversation/api/v1',
        host: 'conv-d.wbx2.com',
        priority: 2,
      },
    ],
  },
  {
    id: 'urn:TEAM:us-east-2_a:idbroker',
    serviceName: 'idbroker',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/idbroker/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://idbroker.webex.com/idb/api/v1',
        host: 'idbroker.webex.com',
        priority: 2,
      },
    ],
  },
  {
    id: 'urn:TEAM:me-central-1_d:idbroker',
    serviceName: 'idbroker',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/idbroker/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://conv-d.wbx2.com/idbroker/api/v1',
        host: 'conv-d.wbx2.com',
        priority: 2,
      },
    ],
  },
  {
    id: 'urn:TEAM:us-east-2_a:locus',
    serviceName: 'locus',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/locus/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://locus-a.wbx2.com/locus/api/v1',
        host: 'locus-a.wbx2.com',
        priority: 2,
      },
    ],
  },
  {
    id: 'urn:TEAM:me-central-1_d:locus',
    serviceName: 'locus',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/locus/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://conv-d.wbx2.com/locus/api/v1',
        host: 'conv-d.wbx2.com',
        priority: 2,
      },
    ],
  },
  {
    id: 'urn:TEAM:us-east-2_a:mercury',
    serviceName: 'mercury',
    serviceUrls: [
      {
        baseUrl: 'https://mercury-a.wbx2.com/mercury/api/v1',
        host: 'mercury-a.wbx2.com',
        priority: 1,
      },
    ],
  },
  {
    id: 'urn:TEAM:me-central-1_d:mercury',
    serviceName: 'mercury',
    serviceUrls: [
      {
        baseUrl: 'https://prod-adxb-message.svc.webex.com/mercury/api/v1',
        host: 'prod-adxb-message.svc.webex.com',
        priority: 1,
      },
      {
        baseUrl: 'https://conv-d.wbx2.com/mercury/api/v1',
        host: 'conv-d.wbx2.com',
        priority: 2,
      },
    ],
  },
];
