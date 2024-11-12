import {assert, expect} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import Webinar from '@webex/plugin-meetings/src/webinar';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-meetings', () => {
    describe('Webinar', () => {

        let webex;
        let webinar;

        beforeEach(() => {
            // @ts-ignore
            webex = new MockWebex({});
            webex.internal.mercury.on = sinon.stub();
            webinar = new Webinar({}, {parent: webex});
            webinar.locusUrl = 'locusUrl';
            webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
            webex.meetings = {};
            webex.meetings.getMeetingByType = sinon.stub();
        });

        describe('#locusUrlUpdate', () => {
            it('sets the locus url', () => {
                webinar.locusUrlUpdate('newUrl');

                assert.equal(webinar.locusUrl, 'newUrl');
            });
        });

        describe('#updateWebcastUrl', () => {
            it('sets the webcast instance url', () => {
                webinar.updateWebcastUrl({resources: {webcastInstance: {url:'newUrl'}}});

                assert.equal(webinar.webcastInstanceUrl, 'newUrl');
            });
        });


        describe('#updateCanManageWebcast', () => {
          it('update canManageWebcast', () => {
            webinar.updateCanManageWebcast(true);

            assert.equal(webinar.canManageWebcast, true);

            webinar.updateCanManageWebcast(false);

            assert.equal(webinar.canManageWebcast, false);
          });
        });
    })
})
