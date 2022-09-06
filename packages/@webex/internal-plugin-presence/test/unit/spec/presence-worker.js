import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import Mercury from '@webex/internal-plugin-mercury';
import Presence from '@webex/internal-plugin-presence';
import MockWebex from '@webex/test-helper-mock-webex';

import PresenceWorker from '../../../src/presence-worker';

const round = (time) => Math.floor(time / 1000);

describe('presence-worker', () => {
  describe('PresenceWorker', () => {
    let webex;
    let worker;
    const id = '1234';

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          mercury: Mercury,
          presence: Presence
        }
      });
      worker = new PresenceWorker();
      worker.webex = webex;
    });

    describe('#initialize()', () => {
      it('requires webex', () => assert.throws(
        worker.initialize,
        /Must initialize Presence Worker with webex!/
      ));
      it('requires webex internal', () => assert.throws(
        () => worker.initialize({}),
        /Must initialize Presence Worker with webex!/
      ));
    });

    describe('#enqueue()', () => {
      it('increments watchers count', () => {
        worker.enqueue(id);
        assert.equal(worker.watchers[id], 1);
        worker.enqueue(id);
        assert.equal(worker.watchers[id], 2);
      });

      it('only increments watcher if subscribed', () => {
        worker.subscribers[id] = true;

        worker.enqueue(id);
        assert.equal(worker.watchers[id], 1);
        assert.notExists(worker.campers[id]);
      });

      it('set camper time to now', () => {
        const now = new Date().getTime();

        worker.enqueue(id);
        assert.equal(round(worker.campers[id]), round(now));
      });

      it('add fetcher', () => {
        worker.enqueue(id);
        assert.exists(worker.fetchers[id]);
      });

      it('stop fetch if there is already a flight', () => {
        worker.flights[id] = true;

        worker.enqueue(id);
        assert.notExists(worker.fetchers[id]);
      });

      it('add fetch if there is an old presence', () => {
        const past = new Date().getTime() - 100000;

        worker.presences[id] = past;

        worker.enqueue(id);
        assert.exists(worker.fetchers[id]);
      });

      it('stop fetch if there is a recent presence', () => {
        const now = new Date().getTime();

        worker.presences[id] = now;

        worker.enqueue(id);
        assert.notExists(worker.fetchers[id]);
      });
    });

    describe('#dequeue()', () => {
      it('does nothing if there are no watchers', () => {
        worker.dequeue(id);
        assert.isUndefined(worker.watchers[id]);
      });

      it('delete values when reached zero', () => {
        worker.watchers[id] = 1;
        worker.fetchers[id] = 1;
        worker.campers[id] = 1;

        worker.dequeue(id);
        assert.isUndefined(worker.watchers[id]);
        assert.isUndefined(worker.fetchers[id]);
        assert.isUndefined(worker.campers[id]);
      });

      it('decrement watchers by one', () => {
        worker.watchers[id] = 5;

        worker.dequeue(id);
        assert.equal(worker.watchers[id], 4);
      });
    });

    describe('#checkFetchers()', () => {
      const boarding = {
        pam: true,
        jim: true,
        dwight: true
      };

      it('moves fetchers to flights', () => {
        webex.internal.presence.list = sinon.stub()
          .returns(Promise.resolve({statusList: []}));

        worker.fetchers = boarding;

        worker.checkFetchers();
        assert.isEmpty(worker.fetchers);
        assert.deepEqual(worker.flights, boarding);
      });

      it('calls presence.list', async () => {
        const response = [
          {subject: 'pam'},
          {subject: 'jim'},
          {subject: 'dwight'}
        ];

        webex.internal.presence.list = sinon.stub()
          .returns(Promise.resolve({statusList: response}));
        webex.internal.presence.emitEvent = sinon.stub();

        worker.fetchers = boarding;

        await worker.checkFetchers();

        assert.calledWith(webex.internal.presence.list, Object.keys(boarding));
        assert.isEmpty(worker.flights);
        assert.deepEqual(Object.keys(worker.presences), Object.keys(boarding));
        assert.calledWith(webex.internal.presence.emitEvent,
          'updated',
          {type: 'presence', payload: {statusList: response}});
      });
    });

    describe('#checkCampers()', () => {
      it('moves campers to subscribers', () => {
        const now = new Date().getTime();
        const scouts = {
          pam: now - 60001, // move them back a little over a minute
          jim: now - 60001,
          dwight: now
        };

        worker.campers = scouts;

        const subbies = worker.checkCampers();

        assert.deepEqual(subbies, ['pam', 'jim']);
      });
    });

    describe('#checkSubscriptions()', () => {
      it('resubscribe to expiring subscriptions', () => {
        const now = new Date().getTime();
        const subbies = {
          pam: now,
          jim: now + 61000, // move forward a little over a minute
          dwight: now
        };
        const watching = {
          pam: 1,
          jim: 1
        };

        worker.watchers = watching;
        worker.subscribers = subbies;

        const renewals = worker.checkSubscriptions();

        assert.deepEqual(renewals, ['pam']);
      });

      it('delete expired subscriptions', () => {
        const now = new Date().getTime();
        const subbies = {
          pam: now + 600000, // move forward 10 minutes
          jim: now - 20000, // move back 20 seconds
          dwight: now - 60000 // move back 1 minute
        };

        worker.subscribers = subbies;

        const renewals = worker.checkSubscriptions();

        assert.deepEqual(renewals, []);
        assert.deepEqual(Object.keys(worker.subscribers), ['pam']);
      });
    });

    describe('#cleanPresences()', () => {
      it('deletes expired presences', () => {
        const now = new Date().getTime();
        const presences = {
          pam: now - 300000, // 5 minutes ago
          jim: now - 600001, // little over 10 minutes ago
          dwight: now - 1200000 // 20 minutes ago
        };

        webex.internal.presence.emitEvent = sinon.stub();
        worker.presences = presences;

        worker.cleanPresences();

        assert.calledWith(webex.internal.presence.emitEvent,
          'updated',
          {type: 'delete', payload: ['jim', 'dwight']});
      });
    });

    describe('#groundskeeper()', () => {
      it('renews subscriptions', async () => {
        webex.internal.presence.subscribe = sinon.stub()
          .returns(Promise.resolve({
            responses: [
              {
                responseCode: 200,
                subscriptionTtl: 600,
                subject: 'pam',
                status: {
                  subject: 'pam'
                }
              },
              {
                responseCode: 500,
                subject: 'jim'
              }]
          }));
        worker.checkCampers = sinon.stub().returns(['pam']);
        worker.checkSubscriptions = sinon.stub().returns(['jim']);
        worker.cleanPresences = sinon.stub();

        await worker.groundskeeper();

        assert.calledWith(webex.internal.presence.subscribe, ['pam', 'jim']);
        assert.deepEqual(Object.keys(worker.subscribers), ['pam', 'jim']);
        assert.deepEqual(Object.keys(worker.presences), ['pam']);
        assert.called(worker.cleanPresences);
      });
    });
  });
});
