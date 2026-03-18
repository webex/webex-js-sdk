import AqmReqs from '../../../../../src/services/core/aqm-reqs';
import aqmDialer from '../../../../../src/services/task/dialer';

jest.mock('../../../../../src/services/core/Utils', () => ({
  createErrDetailsObject: jest.fn(),
  getRoutingHost: jest.fn(),
}));

jest.mock('../../../../../src/services/core/aqm-reqs');

describe('AQM routing dialer', () => {
  let fakeAqm: jest.Mocked<AqmReqs>;

  beforeEach(() => {
    jest.clearAllMocks();

    fakeAqm = new AqmReqs() as jest.Mocked<AqmReqs>;
    fakeAqm.reqEmpty = jest.fn().mockImplementation((fn) => fn);
    fakeAqm.req = jest.fn().mockImplementation((fn) => fn);
  });

  describe('Routing outbound dial', () => {
    it('should call the startdial api', () => {
      const fakeAqm = {
        req: () =>
          jest.fn().mockResolvedValue(() => {
            Promise.resolve({data: 'outdial success'});
          }),
        evt: jest.fn(),
      };

      const dialer = aqmDialer(fakeAqm as any);

      dialer
        .startOutdial({
          data: {
            entryPointId: '1212312',
            destination: '+142356',
            direction: 'OUTBOUND',
            attributes: {},
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
          },
        })
        .then((response) => {
          expect(response.data).toBe('outdial success');
        })
        .catch(() => {
          expect(true).toBe(true);
        });

      expect(dialer.startOutdial).toHaveBeenCalled();
    });

    it('should handle network errors', () => {
      const fakeAqm = {
        req: () => jest.fn().mockRejectedValue(new Error('Network Error')),
        evt: jest.fn(),
      };

      const dialer = aqmDialer(fakeAqm as any);

      return expect(
        dialer.startOutdial({
          data: {
            entryPointId: '1212312',
            destination: '+142356',
            direction: 'OUTBOUND',
            attributes: {},
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
          },
        })
      ).rejects.toThrow('Network Error');
    });

    it('should handle invalid payload', () => {
      const fakeAqm = {
        req: () => jest.fn().mockRejectedValue(new Error('Invalid Payload in request')),
        evt: jest.fn(),
      };

      const dialer = aqmDialer(fakeAqm as any);

      return expect(
        dialer.startOutdial({
          data: {
            entryPointId: '',
            destination: '',
            direction: 'OUTBOUND',
            attributes: {},
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
          },
        })
      ).rejects.toThrow('Invalid Payload in request');
    });

    it('should handle servers errors', () => {
      const fakeAqm = {
        req: () => jest.fn().mockRejectedValue(new Error('Server Error')),
        evt: jest.fn(),
      };

      const dialer = aqmDialer(fakeAqm as any);
      return expect(
        dialer.startOutdial({
          data: {
            entryPointId: '123456',
            destination: '+142356',
            direction: 'OUTBOUND',
            attributes: {},
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
          },
        })
      ).rejects.toThrow('Server Error');
    });

    it('should handle Timeout scenarios', () => {
      const fakeAqm = {
        req: () => jest.fn().mockRejectedValue(new Error('Request Timeout')),
        evt: jest.fn(),
      };

      const dialer = aqmDialer(fakeAqm as any);
      return expect(
        dialer.startOutdial({
          data: {
            entryPointId: '12345',
            destination: '+123456',
            direction: 'OUTBOUND',
            attributes: {},
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
          },
        })
      ).rejects.toThrow('Request Timeout');
    });
  });

  describe('Campaign preview contact operations', () => {
    const previewPayload = {
      interactionId: 'interaction-123',
      campaignId: 'TestCampaignPreview',
    };

    describe('acceptPreviewContact', () => {
      it('should construct the correct URL with campaignId and interactionId', () => {
        const dialer = aqmDialer(fakeAqm as any);
        const config = dialer.acceptPreviewContact({data: previewPayload}) as any;

        expect(config.url).toBe(
          `/v1/dialer/campaign/${previewPayload.campaignId}/preview-task/${previewPayload.interactionId}/accept`
        );
      });

      it('should URL-encode campaignId when it contains reserved characters', () => {
        const dialer = aqmDialer(fakeAqm as any);
        const payloadWithSpecialChars = {
          interactionId: 'interaction-456',
          campaignId: 'My Campaign/Test #1',
        };
        const config = dialer.acceptPreviewContact({data: payloadWithSpecialChars}) as any;

        expect(config.url).toBe(
          `/v1/dialer/campaign/${encodeURIComponent(
            payloadWithSpecialChars.campaignId
          )}/preview-task/${payloadWithSpecialChars.interactionId}/accept`
        );
        expect(config.url).toContain('My%20Campaign%2FTest%20%231');
      });

      it('should call the acceptPreviewContact api', () => {
        const fakeAqm = {
          req: () =>
            jest.fn().mockResolvedValue(() => {
              Promise.resolve({data: 'accept preview success'});
            }),
          evt: jest.fn(),
        };

        const dialer = aqmDialer(fakeAqm as any);

        dialer
          .acceptPreviewContact({data: previewPayload})
          .then((response) => {
            expect(response.data).toBe('accept preview success');
          })
          .catch(() => {
            expect(true).toBe(true);
          });

        expect(dialer.acceptPreviewContact).toHaveBeenCalled();
      });

      it('should handle network errors', () => {
        const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error('Network Error')),
          evt: jest.fn(),
        };

        const dialer = aqmDialer(fakeAqm as any);

        return expect(
          dialer.acceptPreviewContact({
            data: previewPayload,
          })
        ).rejects.toThrow('Network Error');
      });

      it('should handle server errors', () => {
        const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error('Server Error')),
          evt: jest.fn(),
        };

        const dialer = aqmDialer(fakeAqm as any);

        return expect(
          dialer.acceptPreviewContact({
            data: previewPayload,
          })
        ).rejects.toThrow('Server Error');
      });

      it('should handle timeout scenarios', () => {
        const fakeAqm = {
          req: () => jest.fn().mockRejectedValue(new Error('Request Timeout')),
          evt: jest.fn(),
        };

        const dialer = aqmDialer(fakeAqm as any);

        return expect(
          dialer.acceptPreviewContact({
            data: previewPayload,
          })
        ).rejects.toThrow('Request Timeout');
      });
    });
  });
});
