/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable global-require */
import {LocalMicrophoneStream, MediaConnectionEventNames} from '@webex/internal-media-core';
import {ICE_CANDIDATES_TIMEOUT} from '../CallingClient/constants';
import {IPV4_FALLBACK_ADDRESS, MAX_HOST_IPS} from './constants';
import {modifySdpForIPv4} from './callUtils';

const mockRoapMediaConnectionOn = jest.fn();
const mockRoapMediaConnectionInitiateOffer = jest.fn();
const mockRoapMediaConnectionClose = jest.fn();
const mockRoapMediaConnection = jest.fn().mockImplementation(() => ({
  on: mockRoapMediaConnectionOn,
  initiateOffer: mockRoapMediaConnectionInitiateOffer,
  close: mockRoapMediaConnectionClose,
}));

jest.mock('@webex/internal-media-core', () => ({
  ...jest.requireActual('@webex/internal-media-core'),
  RoapMediaConnection: jest
    .fn()
    .mockImplementation((...args: unknown[]) => mockRoapMediaConnection(...args)),
}));

describe('Host ips', () => {
  /* Reloaded for every test, as the discovered addresses are stored in the module. */
  let hostIpUtils: typeof import('./callUtils');

  const localAudioTrack = {id: 'audio-track'} as MediaStreamTrack;
  const localAudioStream = {
    outputStream: {getAudioTracks: () => [localAudioTrack]},
  } as unknown as LocalMicrophoneStream;

  const sdpWithCandidates = (...candidates: string[]) =>
    ['v=0', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', ...candidates].join('\r\n');

  const hostCandidate = (address: string, port = 54321) =>
    `a=candidate:1 1 UDP 2130706431 ${address} ${port} typ host generation 0`;

  /**
   * Makes the media connection emit an offer carrying the given candidates once its negotiation
   * is initiated, followed by any trailing roap messages, or fail that negotiation.
   */
  const mockMediaConnection = ({
    candidates = [] as string[],
    failing = false,
    trailingMessages = [] as Array<Record<string, unknown>>,
  } = {}) => {
    const handlers: Record<string, (event: unknown) => void> = {};

    mockRoapMediaConnectionOn.mockImplementation(
      (event: string, handler: (event: unknown) => void) => {
        handlers[event] = handler;
      }
    );

    mockRoapMediaConnectionInitiateOffer.mockImplementation(async () => {
      if (failing) {
        throw new Error('offer creation failed');
      }

      const emit = handlers[MediaConnectionEventNames.ROAP_MESSAGE_TO_SEND];

      emit?.({
        roapMessage: {messageType: 'OFFER', seq: 1, sdp: sdpWithCandidates(...candidates)},
      });
      trailingMessages.forEach((roapMessage) => emit?.({roapMessage}));
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    hostIpUtils = require('./callUtils');
  });

  describe('getHostIpsFromSdp', () => {
    it.each([
      [
        'host candidates of every interface',
        [hostCandidate('10.0.0.5'), hostCandidate('192.168.1.7', 54322)],
        ['10.0.0.5', '192.168.1.7'],
      ],
      ['IPv6 host candidates', [hostCandidate('2001:db8::1')], ['2001:db8::1']],
      [
        'no server reflexive candidates',
        ['a=candidate:2 1 UDP 1694498815 203.0.113.9 54321 typ srflx raddr 10.0.0.5 rport 54321'],
        [],
      ],
      [
        'no loopback or unspecified addresses',
        [hostCandidate('127.0.0.1'), hostCandidate('::1'), hostCandidate('0.0.0.0')],
        [],
      ],
      ['no synthesised IPv4 fallback address', [hostCandidate(IPV4_FALLBACK_ADDRESS)], []],
      [
        'no duplicates across media sections',
        [hostCandidate('10.0.0.5'), hostCandidate('10.0.0.5', 54322)],
        ['10.0.0.5'],
      ],
    ])('reports %s', (_name, candidates, expected) => {
      expect(hostIpUtils.getHostIpsFromSdp(sdpWithCandidates(...candidates))).toEqual(expected);
    });

    it('reports nothing when there is no sdp', () => {
      expect(hostIpUtils.getHostIpsFromSdp()).toEqual([]);
    });

    it('reports no more addresses than the Mobius api accepts', () => {
      const candidates = Array.from({length: MAX_HOST_IPS + 5}, (_value, index) =>
        hostCandidate(`10.0.0.${index}`)
      );

      expect(hostIpUtils.getHostIpsFromSdp(sdpWithCandidates(...candidates))).toHaveLength(
        MAX_HOST_IPS
      );
    });
  });

  describe('discoverHostIps', () => {
    it('negotiates the offer with the configuration a call uses', async () => {
      mockMediaConnection();

      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(mockRoapMediaConnection).toHaveBeenCalledWith(
        {
          skipInactiveTransceivers: true,
          iceServers: [],
          iceCandidatesTimeout: ICE_CANDIDATES_TIMEOUT,
          sdpMunging: {
            convertPort9to0: true,
            addContentSlides: false,
            copyClineToSessionLevel: true,
          },
        },
        {
          localTracks: {audio: localAudioTrack},
          direction: {audio: 'sendrecv', video: 'inactive', screenShareVideo: 'inactive'},
        },
        'WebexCallSDK-hostIpDiscovery'
      );
    });

    it('stores the host addresses of the offer and closes the connection', async () => {
      mockMediaConnection({
        candidates: [
          hostCandidate('10.0.0.5'),
          'a=candidate:2 1 UDP 1694498815 203.0.113.9 54321 typ srflx raddr 10.0.0.5 rport 54321',
        ],
      });

      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(hostIpUtils.getHostIps()).toEqual(['10.0.0.5']);
      expect(mockRoapMediaConnectionClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the addresses of the offer when a later roap message carries no sdp', async () => {
      mockMediaConnection({
        candidates: [hostCandidate('10.0.0.5')],
        trailingMessages: [{messageType: 'OK', seq: 1}],
      });

      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(hostIpUtils.getHostIps()).toEqual(['10.0.0.5']);
    });

    it('negotiates again on every discovery, storing the addresses of that moment', async () => {
      mockMediaConnection({candidates: [hostCandidate('10.0.0.5')]});
      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(hostIpUtils.getHostIps()).toEqual(['10.0.0.5']);

      mockMediaConnection({candidates: [hostCandidate('192.168.1.7')]});
      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(hostIpUtils.getHostIps()).toEqual(['192.168.1.7']);
      expect(mockRoapMediaConnectionInitiateOffer).toHaveBeenCalledTimes(2);
    });

    it.each([
      ['the negotiation fails', () => mockMediaConnection({failing: true}), 1],
      [
        'the media connection cannot be created',
        () =>
          mockRoapMediaConnection.mockImplementationOnce(() => {
            throw new Error('RTCPeerConnection API is not available in this environment');
          }),
        0,
      ],
    ])('stores nothing when %s', async (_name, failConnection, expectedCloses) => {
      mockMediaConnection({candidates: [hostCandidate('10.0.0.5')]});
      await hostIpUtils.discoverHostIps(localAudioStream);

      failConnection();
      await hostIpUtils.discoverHostIps(localAudioStream);

      expect(hostIpUtils.getHostIps()).toEqual([]);
      expect(mockRoapMediaConnectionClose).toHaveBeenCalledTimes(expectedCloses + 1);
    });
  });
});

describe('modifySdpForIPv4', () => {
  it('should return original SDP if input is empty', () => {
    expect(modifySdpForIPv4('')).toBe('');
  });

  it('should return original SDP if there is no IPv6 c= line', () => {
    const sdp = `v=0\no=- 12345 67890 IN IP4 192.168.1.1\n\ns=Test Session`;
    expect(modifySdpForIPv4(sdp)).toEqual(sdp);
  });

  it('should replace IPv6 c= line with default IPv4 if no IPv4 candidate exists', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    a=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.1.1.1\na=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host\na=candidate:2 1 UDP 2122260223 192.1.1.1 3478 typ host generation 0 network-id 1 network-cost 10`;
    const result = modifySdpForIPv4(sdp);
    expect(result).toEqual(expectedSdp);
  });

  it('should replace IPv6 c= line with an existing IPv4 candidate address', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    a=candidate:1 1 UDP 2122260223 192.168.1.2 3478 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.168.1.2\na=candidate:1 1 UDP 2122260223 192.168.1.2 3478 typ host`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(expectedSdp.trim());
  });

  it('should correctly handle both UDP and TCP candidates by adding only one IPv4 candidate UDP first', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    a=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host
    a=candidate:2 1 TCP 2122260223 2001:db8::2 3479 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.1.1.1\na=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host\na=candidate:2 1 UDP 2122260223 192.1.1.1 3478 typ host generation 0 network-id 1 network-cost 10\na=candidate:2 1 TCP 2122260223 2001:db8::2 3479 typ host\n`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(expectedSdp.trim());
  });

  it('should correctly handle both UDP and TCP candidates by adding only one IPv4 candidate TCP first', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    a=candidate:1 1 TCP 2122260223 2001:db8::2 3479 typ host
    a=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.1.1.1\na=candidate:1 1 TCP 2122260223 2001:db8::2 3479 typ host\na=candidate:2 1 TCP 2122260223 192.1.1.1 3479 typ host generation 0 network-id 1 network-cost 10\na=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(expectedSdp.trim());
  });

  it('should replace all IPv6 c= line if multiple exist', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    c=IN IP6 2001:db8::2
    a=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.1.1.1\nc=IN IP4 192.1.1.1\na=candidate:1 1 UDP 2122260223 2001:db8::1 3478 typ host\na=candidate:2 1 UDP 2122260223 192.1.1.1 3478 typ host generation 0 network-id 1 network-cost 10`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(expectedSdp.trim());
  });

  it('should not modify SDP if IPv6 c= line is absent and IPv4 candidate already exists', () => {
    const sdp = `v=0\no=- 12345 67890 IN IP4 192.168.1.1\ns=Test Session\nc=IN IP4 192.168.1.1\na=candidate:1 1 UDP 2122260223 192.168.1.1 3478 typ host`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(sdp.trim());
  });

  it('should handle malformed SDP gracefully and return unmodified input', () => {
    const malformedSdp = `random text without proper format`;

    expect(modifySdpForIPv4(malformedSdp).trim()).toEqual(malformedSdp.trim());
  });

  it('should handle an SDP with both IP6 and IP4 c= lines correctly', () => {
    const sdp = `v=0
    o=- 12345 67890 IN IP6 2001:db8::1
    s=Test Session
    c=IN IP6 2001:db8::1
    c=IN IP4 192.168.1.3
    a=candidate:1 1 UDP 2122260223 192.168.1.3 3478 typ host`;

    const expectedSdp = `v=0\no=- 12345 67890 IN IP6 2001:db8::1\ns=Test Session\nc=IN IP4 192.168.1.3\nc=IN IP4 192.168.1.3\na=candidate:1 1 UDP 2122260223 192.168.1.3 3478 typ host`;

    expect(modifySdpForIPv4(sdp).trim()).toEqual(expectedSdp.trim());
  });
});
