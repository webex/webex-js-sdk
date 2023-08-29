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
});
