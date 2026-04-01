import 'jsdom-global/register';
import SendSlotManager from '@webex/plugin-meetings/src/multistream/sendSlotManager';
import { LocalStream, MediaType, MultistreamRoapMediaConnection, MediaCodecMimeType } from "@webex/internal-media-core";
import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Metrics from '@webex/plugin-meetings/src/metrics';
import BEHAVIORAL_METRICS from '@webex/plugin-meetings/src/metrics/constants';

describe('SendSlotsManager', () => {
    let sendSlotsManager: SendSlotManager;
    const LoggerProxy = {
        logger: {
            info: sinon.stub(),
            warn: sinon.stub(),
            error: sinon.stub(),
        },
    };

    beforeEach(() => {
        sendSlotsManager = new SendSlotManager(LoggerProxy);
        sinon.stub(Metrics, 'sendBehavioralMetric');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('createSlot', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should create a slot for the given mediaType', () => {
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            assert.calledWith(mediaConnection.createSendSlot, mediaType, true);
        });

        it('should create a slot for the given mediaType & active state', () => {
            sendSlotsManager.createSlot(mediaConnection, mediaType, false);

            assert.calledWith(mediaConnection.createSendSlot, mediaType, false);
        });

        it('should throw an error if a slot for the given mediaType already exists', () => {
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            expect(() => sendSlotsManager.createSlot(mediaConnection, mediaType)).to.throw(`Slot for ${mediaType} already exists`);
        });
    });

    describe('getSlot', () => {
        const mediaType = MediaType.AudioMain;
        let mediaConnection;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub().returns({}),
            } as MultistreamRoapMediaConnection;
        });

        it('should return the slot for the given mediaType', () => {
            const slot = sendSlotsManager.createSlot(mediaConnection,mediaType);

            expect(sendSlotsManager.getSlot(mediaType)).to.equal(slot);
        });

        it('should throw an error if a slot for the given mediaType does not exist', () => {
            expect(() => sendSlotsManager.getSlot(mediaType)).to.throw(`Slot for ${mediaType} does not exist`);
        });
    });

    describe('publishStream', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;
        const stream = {} as LocalStream;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should publish the given stream to the sendSlot for the given mediaType', async () => {
            const slot = {
                publishStream: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.publishStream(mediaType, stream);

            assert.calledWith(slot.publishStream, stream);
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.publishStream(mediaType, stream))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });
    });

    describe('unpublishStream', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should unpublish the stream from the sendSlot of the given mediaType', async () => {
            const slot = {
                unpublishStream: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.unpublishStream(mediaType);

            assert.called(slot.unpublishStream);
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.unpublishStream(mediaType))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });
    });

  describe('setNamedMediaGroups', () => {
    let mediaConnection;
    const mediaType = MediaType.AudioMain;
    const groups = [{type: 1, value: 20}];

    beforeEach(() => {
      mediaConnection = {
        createSendSlot: sinon.stub(),
      } as MultistreamRoapMediaConnection;
    });

    it('should publish the given stream to the sendSlot for the given mediaType', async () => {
      const slot = {
        setNamedMediaGroups: sinon.stub().resolves(),
      };
      mediaConnection.createSendSlot.returns(slot);
      sendSlotsManager.createSlot(mediaConnection, mediaType);

      await sendSlotsManager.setNamedMediaGroups(mediaType, groups);

      assert.calledWith(slot.setNamedMediaGroups, groups);
    });

    it('should throw an error if the given mediaType is not audio', () => {
      expect(() => sendSlotsManager.setNamedMediaGroups(MediaType.VideoMain, groups)).to.throw(`sendSlotManager cannot set named media group which media type is ${MediaType.VideoMain}`)
    });

    it('should throw an error if a slot for the given mediaType does not exist', () => {
      expect(() => sendSlotsManager.setNamedMediaGroups(mediaType, groups)).to.throw(`Slot for ${mediaType} does not exist`)
    });
  });

    describe('setActive', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should set the active state of the sendSlot for the given mediaType', () => {
            const slot = {
                active: false,
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            sendSlotsManager.setActive(mediaType, true);

            expect(slot.active).to.be.true;
        });

        it('should throw an error if a slot for the given mediaType does not exist', () => {
            expect(() => sendSlotsManager.setActive(mediaType)).to.throw(`Slot for ${mediaType} does not exist`)
        });
    });

    describe('setCodecParameters', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;
        const codecParameters = {};

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should delegate to slot.setCodecParameters, log deprecation warning and send deprecation metric', async () => {
            const slot = {
                setCodecParameters: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.setCodecParameters(mediaType, codecParameters);

            assert.calledWith(slot.setCodecParameters, codecParameters);
            assert.called(LoggerProxy.logger.warn);
            assert.calledWith(Metrics.sendBehavioralMetric as sinon.SinonStub,
                BEHAVIORAL_METRICS.DEPRECATED_SET_CODEC_PARAMETERS_USED,
                { mediaType, codecParameters }
            );
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.setCodecParameters(mediaType, codecParameters))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });
    });

    describe('deleteCodecParameters', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should delegate to slot.deleteCodecParameters, log deprecation warning and send deprecation metric', async () => {
            const slot = {
                deleteCodecParameters: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.deleteCodecParameters(mediaType, []);

            assert.calledWith(slot.deleteCodecParameters, []);
            assert.called(LoggerProxy.logger.warn);
            assert.calledWith(Metrics.sendBehavioralMetric as sinon.SinonStub,
                BEHAVIORAL_METRICS.DEPRECATED_DELETE_CODEC_PARAMETERS_USED,
                { mediaType, parameters: [] }
            );
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.deleteCodecParameters(mediaType, []))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });
    });

    describe('setCustomCodecParameters', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;
        const codecMimeType = MediaCodecMimeType.OPUS;
        const parameters = { maxaveragebitrate: '64000' };

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should set custom codec parameters on the sendSlot for the given mediaType and codec, log info and send metric', async () => {
            const slot = {
                setCustomCodecParameters: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.setCustomCodecParameters(mediaType, codecMimeType, parameters);

            assert.calledWith(slot.setCustomCodecParameters, codecMimeType, parameters);
            assert.called(LoggerProxy.logger.info);
            assert.calledWith(Metrics.sendBehavioralMetric as sinon.SinonStub,
                BEHAVIORAL_METRICS.SET_CUSTOM_CODEC_PARAMETERS_USED,
                { mediaType, codecMimeType, parameters }
            );
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.setCustomCodecParameters(mediaType, codecMimeType, parameters))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });

        it('should throw and log error when setCustomCodecParameters fails', async () => {
            const error = new Error('codec parameter failure');
            const slot = {
                setCustomCodecParameters: sinon.stub().rejects(error),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await expect(sendSlotsManager.setCustomCodecParameters(mediaType, codecMimeType, parameters))
                .to.be.rejectedWith('codec parameter failure');

            assert.called(LoggerProxy.logger.error);
            assert.calledWith(Metrics.sendBehavioralMetric as sinon.SinonStub,
                BEHAVIORAL_METRICS.SET_CUSTOM_CODEC_PARAMETERS_USED,
                { mediaType, codecMimeType, parameters }
            );
        });
    });

    describe('markCustomCodecParametersForDeletion', () => {
        let mediaConnection;
        const mediaType = MediaType.AudioMain;
        const codecMimeType = MediaCodecMimeType.OPUS;
        const parameters = ['maxaveragebitrate', 'maxplaybackrate'];

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub(),
            } as MultistreamRoapMediaConnection;
        });

        it('should mark custom codec parameters for deletion on the sendSlot for the given mediaType and codec, log info and send metric', async () => {
            const slot = {
                markCustomCodecParametersForDeletion: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.markCustomCodecParametersForDeletion(mediaType, codecMimeType, parameters);

            assert.calledWith(slot.markCustomCodecParametersForDeletion, codecMimeType, parameters);
            assert.called(LoggerProxy.logger.info);
            assert.calledWith(Metrics.sendBehavioralMetric as sinon.SinonStub,
                BEHAVIORAL_METRICS.MARK_CUSTOM_CODEC_PARAMETERS_FOR_DELETION_USED,
                { mediaType, codecMimeType, parameters }
            );
        });

        it('should throw an error if a slot for the given mediaType does not exist', async () => {
            await expect(sendSlotsManager.markCustomCodecParametersForDeletion(mediaType, codecMimeType, parameters))
                .to.be.rejectedWith(`Slot for ${mediaType} does not exist`);
        });
    });

    describe('reset', () => {
        let mediaConnection;

        beforeEach(() => {
            mediaConnection = {
                createSendSlot: sinon.stub().returns({}),
            } as MultistreamRoapMediaConnection;
        });

        it('should reset the send slot manager', () => {
            const AudioSlot = sendSlotsManager.createSlot(mediaConnection, MediaType.AudioMain);
            const VideoSlot = sendSlotsManager.createSlot(mediaConnection, MediaType.VideoMain);
            const AudioSlidesSlot = sendSlotsManager.createSlot(mediaConnection, MediaType.AudioSlides);
            const VideoSlidesSlot = sendSlotsManager.createSlot(mediaConnection, MediaType.VideoSlides);
            expect(sendSlotsManager.getSlot(MediaType.AudioMain)).to.equal(AudioSlot);
            expect(sendSlotsManager.getSlot(MediaType.VideoMain)).to.equal(VideoSlot);
            expect(sendSlotsManager.getSlot(MediaType.AudioSlides)).to.equal(AudioSlidesSlot);
            expect(sendSlotsManager.getSlot(MediaType.VideoSlides)).to.equal(VideoSlidesSlot);
            sendSlotsManager.reset();
            expect(() => sendSlotsManager.getSlot(MediaType.AudioMain)).to.throw();
            expect(() => sendSlotsManager.getSlot(MediaType.VideoMain)).to.throw();
            expect(() => sendSlotsManager.getSlot(MediaType.AudioSlides)).to.throw();
            expect(() => sendSlotsManager.getSlot(MediaType.VideoSlides)).to.throw();
        });
    });

    describe('sourceStateOverride', () => {
      let mediaConnection: MultistreamRoapMediaConnection;
      beforeEach(() => {
        mediaConnection = {
          createSendSlot: sinon.stub().returns({
            setSourceStateOverride: sinon.stub().resolves(),
            clearSourceStateOverride: sinon.stub().resolves(),
          }),
        } as MultistreamRoapMediaConnection;
      });

      it(`can set source state override for ${MediaType.VideoMain}`, () => {
        const slot: any = sendSlotsManager.createSlot(mediaConnection, MediaType.VideoMain);

        const set = () => sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, 'away');

        expect(set).not.to.throw();
        expect(slot.setSourceStateOverride.calledWith('away')).to.be.true;
      });

      [MediaType.VideoSlides, MediaType.AudioMain, MediaType.AudioSlides].forEach((mediaType) => {
        it(`can't set source state override for ${mediaType}`, () => {
          const slot: any = sendSlotsManager.createSlot(mediaConnection, mediaType);

          const set = () => sendSlotsManager.setSourceStateOverride(mediaType, 'away');

          expect(set).to.throw();
          expect(slot.setSourceStateOverride.called).to.be.false;
        });
      });

      it("can't set source state override for non-existing slot", () => {
        const set = () => sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, 'away');
        expect(set).to.throw(`Slot for ${MediaType.VideoMain} does not exist`);
      });

      it('can clear source state override', () => {
        const slot: any = sendSlotsManager.createSlot(mediaConnection, MediaType.VideoMain);
        sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, 'away');

        expect(slot.setSourceStateOverride.calledWith('away')).to.be.true;
        expect(slot.clearSourceStateOverride.called).to.be.false;

        sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, null);
        expect(slot.clearSourceStateOverride.called).to.be.true;
      });

      it("won't set source state override if it didn't change", () => {
        const slot: any = sendSlotsManager.createSlot(mediaConnection, MediaType.VideoMain);
        sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, 'away');

        expect(slot.setSourceStateOverride.calledWith('away')).to.be.true;
        slot.setSourceStateOverride.resetHistory();

        sendSlotsManager.setSourceStateOverride(MediaType.VideoMain, 'away');
        expect(slot.setSourceStateOverride.called).to.be.false;
      });
    });
});
