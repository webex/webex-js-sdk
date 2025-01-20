import {assert, expect} from '@webex/test-helper-chai';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import Webinar from '@webex/plugin-meetings/src/webinar';
import MockWebex from '@webex/test-helper-mock-webex';
import uuid from 'uuid';
import sinon from 'sinon';

describe('plugin-meetings', () => {
    describe('Webinar', () => {

        let webex;
        let webinar;
        let uuidStub;
        let getUserTokenStub;

        beforeEach(() => {
            // @ts-ignore
            getUserTokenStub = sinon.stub().resolves('test-token');
            uuidStub = sinon.stub(uuid,'v4').returns('test-uuid');
            webex = new MockWebex({});
            webex.internal.mercury.on = sinon.stub();
            webinar = new Webinar({}, {parent: webex});
            webinar.locusUrl = 'locusUrl';
            webinar.webcastInstanceUrl = 'webcastInstanceUrl';
            webex.request = sinon.stub().returns(Promise.resolve('REQUEST_RETURN_VALUE'));
            webex.meetings = {};
            webex.credentials.getUserToken = getUserTokenStub;
            webex.meetings.getMeetingByType = sinon.stub();

        });

        afterEach(() => {
          sinon.restore();
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
          it('sets the webcast instance url when valid', () => {
            webinar.updateWebcastUrl({resources: {webcastInstance: {url:'newUrl'}}});
            assert.equal(webinar.webcastInstanceUrl, 'newUrl', 'webcast instance URL should be updated');
          });

          it('handles missing resources gracefully', () => {
              webinar.updateWebcastUrl({});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });

          it('handles missing webcastInstance gracefully', () => {
              webinar.updateWebcastUrl({resources: {}});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });

          it('handles missing URL gracefully', () => {
              webinar.updateWebcastUrl({resources: {webcastInstance: {}}});
              assert.isUndefined(webinar.webcastInstanceUrl, 'webcast instance URL should be undefined');
          });
        });

      describe('#updateRoleChanged', () => {
        it('updates roles when promoted from attendee to panelist', () => {
          const payload = {
            oldRoles: ['ATTENDEE'],
            newRoles: ['PANELIST']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, true, 'should indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when demoted from panelist to attendee', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['ATTENDEE']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when attendee just join meeting', () => {
          const payload = {
            oldRoles: [''],
            newRoles: ['ATTENDEE']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, true, 'self should be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, true, 'should indicate demotion');
        });

        it('updates roles when promoted to moderator', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['MODERATOR']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, false, 'self should not be a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, true, 'self should have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });

        it('updates roles when unchanged (remains as panelist)', () => {
          const payload = {
            oldRoles: ['PANELIST'],
            newRoles: ['PANELIST']
          };

          const result = webinar.updateRoleChanged(payload);

          assert.equal(webinar.selfIsPanelist, true, 'self should remain a panelist');
          assert.equal(webinar.selfIsAttendee, false, 'self should not be an attendee');
          assert.equal(webinar.canManageWebcast, false, 'self should not have manage webcast capability');
          assert.equal(result.isPromoted, false, 'should not indicate promotion');
          assert.equal(result.isDemoted, false, 'should not indicate demotion');
        });
      });

      describe('#updateStatusByRole', () => {
        let updateLLMConnection;
        let updateMediaShares;
        beforeEach(() => {
          // @ts-ignore
          updateLLMConnection = sinon.stub();
          updateMediaShares = sinon.stub()
          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id',
              updateLLMConnection: updateLLMConnection,
              shareStatus: 'whiteboard_share_active',
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares
              }
            })
          };
        });

        afterEach(() => {
          sinon.restore();
        });

        it('trigger updateLLMConnection if PS started', () => {

          webinar.practiceSessionEnabled = true;
          const roleChange = {isPromoted: true, isDemoted: false};

          const result = webinar.updateStatusByRole(roleChange);

          assert.calledOnce(updateLLMConnection);
        });

        it('Not trigger updateLLMConnection if PS not started', () => {

          webinar.practiceSessionEnabled = false;
          const roleChange = {isPromoted: true, isDemoted: false};

          const result = webinar.updateStatusByRole(roleChange);

          assert.notCalled(updateLLMConnection);
        });

        it('trigger updateMediaShares if promoted', () => {

          const roleChange = {isPromoted: true, isDemoted: false};

          const result = webinar.updateStatusByRole(roleChange);

          assert.calledOnce(updateMediaShares);
        });

        it('Not trigger updateMediaShares if no role change', () => {

          const roleChange = {isPromoted: false, isDemoted: false};

          const result = webinar.updateStatusByRole(roleChange);

          assert.notCalled(updateMediaShares);
        });
        it('trigger updateMediaShares if is promoted', () => {

          const roleChange = {isPromoted: true, isDemoted: false};

          const result = webinar.updateStatusByRole(roleChange);

          assert.calledOnce(updateMediaShares);
        });

        it('trigger updateMediaShares if is attendee with whiteboard share', () => {

          const roleChange = {isPromoted: false, isDemoted: true};

          const result = webinar.updateStatusByRole(roleChange);

          assert.calledOnce(updateMediaShares);
        });

        it('Not trigger updateMediaShares if is attendee with screen share', () => {

          webinar.webex.meetings = {
            getMeetingByType: sinon.stub().returns({
              id: 'meeting-id',
              updateLLMConnection: updateLLMConnection,
              shareStatus: 'remote_share_active',
              locusInfo: {
                mediaShares: 'mediaShares',
                updateMediaShares: updateMediaShares
              }
            })
          };

          const roleChange = {isPromoted: false, isDemoted: true};

          const result = webinar.updateStatusByRole(roleChange);

          assert.notCalled(updateMediaShares);
        });
      });

      describe("#setPracticeSessionState", () => {
        [true, false].forEach((enabled) => {
          it(`sends a PATCH request to ${enabled ? "enable" : "disable"} the practice session`, async () => {
            const result = await webinar.setPracticeSessionState(enabled);
            assert.calledOnce(webex.request);
            assert.calledWith(webex.request, {
              method: "PATCH",
              uri: `${webinar.locusUrl}/controls`,
              body: {
                practiceSession: { enabled }
              }
            });
            assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
          });
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.setPracticeSessionState(true);
            assert.fail('setPracticeSessionState should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#setPracticeSessionState failed', sinon.match.instanceOf(Error));
          }

          errorLogger.restore();
        });
      });

      describe('#isJoinPracticeSessionDataChannel', () => {
        it('check whether should join PS data channel', () => {
          webinar.selfIsPanelist = true;
          webinar.practiceSessionEnabled = false;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);

          webinar.selfIsPanelist = true;
          webinar.practiceSessionEnabled = true;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), true);

          webinar.selfIsPanelist = false;
          webinar.practiceSessionEnabled = false;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);

          webinar.selfIsPanelist = false;
          webinar.practiceSessionEnabled = true;

          assert.equal(webinar.isJoinPracticeSessionDataChannel(), false);
        });
      });

      describe('#updatePracticeSessionStatus', () => {
        it('sets PS state true', () => {
          webinar.updatePracticeSessionStatus({enabled: true});

          assert.equal(webinar.practiceSessionEnabled, true);
        });
        it('sets PS state true', () => {
          webinar.updatePracticeSessionStatus({enabled: false});

          assert.equal(webinar.practiceSessionEnabled, false);
        });
      });

      describe("#startWebcast", () => {
        const meeting = {
          locusId: 'locusId',
          correlationId: 'correlationId',
        }
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        }
        it(`sends a PUT request to start the webcast`, async () => {
          const result = await webinar.startWebcast(meeting, layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              action: 'start',
              meetingInfo: {
                locusId: meeting.locusId,
                correlationId: meeting.correlationId,
              },
              layout,
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('should handle undefined meeting parameter', async () => {
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.startWebcast(undefined, layout);
            assert.fail('startWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'Meeting parameter does not meet expectations', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, `Meeting:webinar#startWebcast failed --> meeting parameter : ${undefined}`);
          } finally {
            errorLogger.restore();
          }
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.startWebcast(meeting, layout);
            assert.fail('startWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#startWebcast failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#stopWebcast", () => {
        it(`sends a PUT request to stop the webcast`, async () => {
          const result = await webinar.stopWebcast();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/streaming`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              action: 'stop',
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.stopWebcast();
            assert.fail('stopWebcast should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#stopWebcast failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });


      describe("#queryWebcastLayout", () => {
        it(`sends a GET request to query the webcast layout`, async () => {
          const result = await webinar.queryWebcastLayout();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/layout`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.queryWebcastLayout();
            assert.fail('queryWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#queryWebcastLayout failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#updateWebcastLayout", () => {
        const layout = {
          videoLayout: 'Prominent',
          contentLayout: 'Prominent',
          syncStageLayout: false,
          syncStageInMeeting: false,
        }
        it(`sends a PUT request to update the webcast layout`, async () => {
          const result = await webinar.updateWebcastLayout(layout);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "PUT",
            uri: `${webinar.webcastInstanceUrl}/layout`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
              'Content-Type': 'application/json'
            },
            body: {
              ...layout
            }
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.updateWebcastLayout(layout);
            assert.fail('updateWebcastLayout should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#updateWebcastLayout failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#searchWebcastAttendees", () => {
        const queryString = 'queryString';
        const specialCharsQuery = 'query@string!';
        const emptyQuery = '';

        it("sends a GET request to search the webcast attendees", async () => {
          const result = await webinar.searchWebcastAttendees(queryString);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(queryString)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.searchWebcastAttendees(queryString);
            assert.fail('searchWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#searchWebcastAttendees failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });

        it("should handle empty query string", async () => {
          const result = await webinar.searchWebcastAttendees(emptyQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(emptyQuery)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it("should handle query string with special characters", async () => {
          const result = await webinar.searchWebcastAttendees(specialCharsQuery);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees?keyword=${encodeURIComponent(specialCharsQuery)}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });
      });


      describe("#viewAllWebcastAttendees", () => {
        it(`sends a GET request to view all the webcast attendees`, async () => {
          const result = await webinar.viewAllWebcastAttendees();
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "GET",
            uri: `${webinar.webcastInstanceUrl}/attendees`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.viewAllWebcastAttendees();
            assert.fail('viewAllWebcastAttendees should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#viewAllWebcastAttendees failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });

      describe("#expelWebcastAttendee", () => {
        const participantId = 'participantId'
        it(`sends a DELETE request to expel the webcast attendee`, async () => {
          const result = await webinar.expelWebcastAttendee(participantId);
          assert.calledOnce(webex.request);
          assert.calledWith(webex.request, {
            method: "DELETE",
            uri: `${webinar.webcastInstanceUrl}/attendees/${participantId}`,
            headers: {
              authorization: 'test-token',
              trackingId: 'webex-js-sdk_test-uuid',
            },
          });
          assert.equal(result, "REQUEST_RETURN_VALUE", "should return the resolved value from the request");
        });

        it('handles API call failures gracefully', async () => {
          webex.request.rejects(new Error('API_ERROR'));
          const errorLogger = sinon.stub(LoggerProxy.logger, 'error');

          try {
            await webinar.expelWebcastAttendee(participantId);
            assert.fail('expelWebcastAttendee should throw an error');
          } catch (error) {
            assert.equal(error.message, 'API_ERROR', 'should throw the correct error');
            assert.calledOnce(errorLogger);
            assert.calledWith(errorLogger, 'Meeting:webinar#expelWebcastAttendee failed', sinon.match.instanceOf(Error));
          } finally {
            errorLogger.restore();
          }
        });
      });
    })
})
