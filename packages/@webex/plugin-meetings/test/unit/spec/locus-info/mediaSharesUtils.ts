import MediaSharesUtils from '@webex/plugin-meetings/src/locus-info/mediaSharesUtils';
import {assert} from "chai";
import Sinon from "sinon";

describe('getShareInstanceId', () => {
  it('getShareInstanceId return correct shareInstanceId value', () => {
    const stub = Sinon.stub(MediaSharesUtils, 'extractContent').returns({ floor:{shareInstanceId:'shareInstanceId'}});
    const shareInstanceId = MediaSharesUtils.getShareInstanceId();
    assert.equal(shareInstanceId,'shareInstanceId');
    stub.restore();
  });
});

describe('getContentUrl', () => {
  it('getContentUrl return correct url value', () => {
    const stub = Sinon.stub(MediaSharesUtils, 'extractContent').returns({url:'url'});
    const url = MediaSharesUtils.getContentUrl();
    assert.equal(url,'url');
    stub.restore();
  });
});

describe('getDeviceUrlRequestingShare', () => {
  it('getDeviceUrlRequestingShare return correct deviceUrl value', () => {
    const stub = Sinon.stub(MediaSharesUtils, 'extractContentFloor').returns({ requester: {deviceUrl:'deviceUrlSharing'}});
    const deviceUrlSharing = MediaSharesUtils.getDeviceUrlRequestingShare();
    assert.equal(deviceUrlSharing,'deviceUrlSharing');
    stub.restore();
  });
});

