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

describe('getContentResourceType', () => {
  it('getContentResourceType return correct resourceType value', () => {
    const stub = Sinon.stub(MediaSharesUtils, 'extractContent').returns({resourceType:'resourceType'});
    const resourceType = MediaSharesUtils.getContentResourceType();
    assert.equal(resourceType,'resourceType');
    stub.restore();
  });
});

describe('getContentBeneficiaryDeviceUrl', () => {
  it('getContentBeneficiaryDeviceUrl return correct deviceUrl value', () => {
    const mockContentBeneficiaryDeviceUrl = "https://wdm-a.wbx2.com/wdm/api/v1/devices/e9ffd8a1-1fae-42d1-afbe-013e951f93ab"
    const stub = Sinon.stub(MediaSharesUtils, 'extractContentFloor').returns({ beneficiary: {deviceUrl : mockContentBeneficiaryDeviceUrl}});
    const contentBeneficiaryDeviceUrl = MediaSharesUtils.getContentBeneficiaryDeviceUrl();
    assert.equal(contentBeneficiaryDeviceUrl, mockContentBeneficiaryDeviceUrl);
    stub.restore();
  });
});

