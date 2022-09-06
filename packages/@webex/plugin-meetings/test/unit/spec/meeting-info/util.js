import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/util';

describe('plugin-meetings', () => {
  describe('meeting-info#util', () => {
    describe('#generateOptions()', () => {
      it('should resolve with a \'wasHydraPerson\' key:value when provided a hydra person Id', () => {
        const getSipUriFromHydraPersonId = sinon
          .stub(MeetingInfoUtil, 'getSipUriFromHydraPersonId')
          .resolves('example-destination');

        const isConversationUrl = sinon
          .stub(MeetingInfoUtil, 'isConversationUrl')
          .returns(false);

        return MeetingInfoUtil.generateOptions({
          destination: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS81NTU1NTU1NS01NTU1LTU1NTUtODU1NS01NTU1NTU1NTU1NTU='
        })
          .then(({wasHydraPerson}) => {
            assert.isTrue(wasHydraPerson);

            getSipUriFromHydraPersonId.restore();
            isConversationUrl.restore();
          });
      });
    });

    describe('#getHydraId()', () => {
      it('should provide the clusterId of a given roomId', () => {
        // US Cluster fake roomId.
        const roomId = 'Y2lzY29zcGFyazovL3VzL1JPT00vYzEwODQ5YzAtNTZlMy0yMmViLWE4Y2ItZTllNzcwN2JjY2I4';

        assert.equal(MeetingInfoUtil.getHydraId(roomId).cluster, 'us');
      });
    });
  });
});
