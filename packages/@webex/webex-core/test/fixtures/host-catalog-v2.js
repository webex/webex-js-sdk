const hostCatalogV2 = {
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
  ],
  orgId: '3e0e410f-f83f-4ee4-ac32-12692e99355c',
  timestamp: '1745533341',
  format: 'U2Cv2',
};
