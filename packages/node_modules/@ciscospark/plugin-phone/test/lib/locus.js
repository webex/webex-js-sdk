export function makeLocus({
  id = 1, lastActive = 1, correlationId = 1, sequence = [1], replaces
}) {
  const locus = {
    fullState: {
      lastActive,
      type: 'CALL'
    },
    participants: [
      {
        id: 'a',
        person: {
          id: '88888888-4444-4444-4444-AAAAAAAAAAA1'
        },
        type: 'USER',
        url: `https://example.com/locus/${id}/participant/1`,
        state: 'IDLE'
      },
      {
        id: 'b',
        person: {
          id: '88888888-4444-4444-4444-AAAAAAAAAAA2'
        },
        type: 'USER',
        url: `https://example.com/locus/${id}/participant/2`,
        state: 'IDLE'
      }
    ],
    self: {
      self: 'https://example.com/devices/1',
      alertType: {
        action: 'FULL'
      },
      devices: [
        {
          correlationId,
          mediaConnections: [
            {
              remoteSdp: JSON.stringify({
                sdp: 'mock'
              })
            }
          ],
          url: 'https://example.com/devices/1'
        }
      ]
    },
    sequence: {
      entries: sequence
    },
    url: `https://example.com/locus/${id}`
  };

  if (Array.isArray(replaces)) {
    locus.replaces = [];
    for (const replaced of replaces) {
      locus.replaces.push({
        locusUrl: `https://example.com/locus/${replaced.id}`,
        lastActive: replaced.lastActive
      });
    }
  }
  else if (replaces) {
    locus.replaces = [{
      locusUrl: `https://example.com/locus/${replaces.id}`,
      lastActive: replaces.lastActive
    }];
  }

  return locus;
}


export function makeLocusEvent(locusSummary, eventType = 'locus.participant_joined') {
  return {
    data: {
      data: {
        eventType,
        locus: makeLocus(locusSummary)
      }
    }
  };
}
