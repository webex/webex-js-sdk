import 'jsdom-global/register';
import SendSlotManager from '@webex/plugin-meetings/src/multistream/sendSlotManager';
import { LocalStream, MediaType, MultistreamRoapMediaConnection } from "@webex/internal-media-core";
import {expect} from '@webex/test-helper-chai';
import sinon from 'sinon';

describe('SendSlotsManager', () => {
    let sendSlotsManager: SendSlotManager;
    const LoggerProxy = {
        logger: {
            info: sinon.stub(),
        },
    };

    beforeEach(() => {
        sendSlotsManager = new SendSlotManager(LoggerProxy);
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

            expect(mediaConnection.createSendSlot.calledWith(mediaType, true));
        });

        it('should create a slot for the given mediaType & active state', () => {
            sendSlotsManager.createSlot(mediaConnection, mediaType, false);

            expect(mediaConnection.createSendSlot.calledWith(mediaType, false));
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

            expect(slot.publishStream.calledWith(stream));
        });

        it('should throw an error if a slot for the given mediaType does not exist', (done) => {
            sendSlotsManager.publishStream(mediaType, stream).catch((error) => {
                expect(error.message).to.equal(`Slot for ${mediaType} does not exist`);
                done();
            });
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

            expect(slot.unpublishStream.called);
        });

        it('should throw an error if a slot for the given mediaType does not exist',(done) => {
            sendSlotsManager.unpublishStream(mediaType).catch((error) => {
                expect(error.message).to.equal(`Slot for ${mediaType} does not exist`);
                done();
            });
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

      expect(slot.setNamedMediaGroups.calledWith(groups));
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

        it('should set the active state of the sendSlot for the given mediaType', async () => {
            const slot = {
                setActive: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.setActive(mediaType,true);

            expect(slot.setActive.called);
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

        it('should set the codec parameters of the sendSlot for the given mediaType', async () => {
            const slot = {
                setCodecParameters: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.setCodecParameters(mediaType, codecParameters);

            expect(slot.setCodecParameters.calledWith(codecParameters));
        });

        it('should throw an error if a slot for the given mediaType does not exist', (done) => {
            sendSlotsManager.setCodecParameters(mediaType, codecParameters).catch((error) => {
                expect(error.message).to.equal(`Slot for ${mediaType} does not exist`);
                done();
            });
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

        it('should delete the codec parameters of the sendSlot for the given mediaType', async () => {
            const slot = {
                deleteCodecParameters: sinon.stub().resolves(),
            };
            mediaConnection.createSendSlot.returns(slot);
            sendSlotsManager.createSlot(mediaConnection, mediaType);

            await sendSlotsManager.deleteCodecParameters(mediaType,[]);

            expect(slot.deleteCodecParameters.called);
        });

        it('should throw an error if a slot for the given mediaType does not exist', (done) => {
            sendSlotsManager.deleteCodecParameters(mediaType,[]).catch((error) => {
                expect(error.message).to.equal(`Slot for ${mediaType} does not exist`);
                done();
            });
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
