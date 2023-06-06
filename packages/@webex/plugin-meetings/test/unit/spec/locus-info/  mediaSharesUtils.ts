import MediaSharesUtils from '@webex/plugin-meetings/src/locus-info/mediaSharesUtils';
import {assert} from "chai";
import Sinon from "sinon";

describe('getShareInstanceId', () => {
  it('getShareInstanceId return shareInstanceId value', () => {
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

