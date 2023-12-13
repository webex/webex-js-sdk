import {assert, expect} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import Webinar from '@webex/plugin-meetings/src/webinar';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-meetings', () => {
    describe('WebinarMeeting', () => {

        let webex;
        let webinarMeeting;

        beforeEach(() => {
            // @ts-ignore
            webex = new MockWebex({});
            webex.internal.mercury.on = sinon.stub();
            webinarMeeting = new Webinar({}, {parent: webex});
            webinarMeeting.locusUrl = 'locusUrl';
            webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
            webex.meetings = {};
            webex.meetings.getMeetingByType = sinon.stub();
        });

        describe('#locusUrlUpdate', () => {
            it('sets the locus url', () => {
                webinarMeeting.locusUrlUpdate('newUrl');

                assert.equal(webinarMeeting.locusUrl, 'newUrl');
            });
        });

        describe('#webcastUrlUpdate', () => {
            it('sets the webcast url', () => {
                webinarMeeting.webcastUrlUpdate('newUrl');

                assert.equal(webinarMeeting.webcastUrl, 'newUrl');
            });
        });

        describe('#webinarAttendeesSearchingUrlUpdate', () => {
            it('sets the webinarAttendeesSearching url', () => {
                webinarMeeting.webinarAttendeesSearchingUrlUpdate('newUrl');

                assert.equal(webinarMeeting.webinarAttendeesSearchingUrl, 'newUrl');
            });
        });
    })
})
