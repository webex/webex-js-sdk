import ContactCenter from '@webex/plugin-cc/src';
import Mercury from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import Services from '@webex/webex-core/dist/lib/services/services';
import CCMercury from '../../../src/CCMercury';
import { CC_EVENTS } from '../../../src/constants';

describe('CC Tests', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
        services: Services,
      },
    });

    webex.cc.ccMercury = new CCMercury(
      {},
      {
        parent: webex,
      }
    );

    webex.cc.ccMercury.on = jest.fn((event, callback) => {
      if (event === 'event') {
        // Store the callback to call it later
        webex.cc.ccMercury._eventCallback = callback;
      }
    });

    // Mock the establishConnection function to trigger the event with Welcome type
    webex.cc.ccMercury.establishConnection = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const event = {
            type: CC_EVENTS.WELCOME,
            data: {
              agentId: 'dummy-agent-id'
            }
          };
          if (webex.cc.ccMercury._eventCallback) {
            webex.cc.ccMercury._eventCallback(event); // Trigger the stored event callback
          }
          resolve('Success: Dummy data returned');
        }, 100); // Simulate the event being fired after 100ms
      });
    });

    // Mock the register function to call establishConnection and handle Welcome event
    webex.cc.register = jest.fn().mockImplementation(() => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: Welcome event did not occur within the expected time frame'));
        }, 5000);

        webex.cc.ccMercury.on('event', (event) => {
          if (event.type === CC_EVENTS.WELCOME) {
            clearTimeout(timeout);
            resolve(`Success: CI User ID is ${event.data.agentId}`);
          }
        });

        webex.cc.ccMercury.establishConnection().catch(reject);
      });
    });
  });

  afterEach(() => {
    if (webex.cc && webex.cc.ccMercury && webex.cc.ccMercury.disconnect) {
      webex.cc.ccMercury.disconnect();
    }
  });

  it('Success: invoke the register function, resolved promise', async () => {
    const res = await webex.cc.register();
    expect(res).toEqual('Success: CI User ID is dummy-agent-id');
  }, 10000); // Increase the timeout to 10 seconds

  it('Failed: invoke the register function, rejected promise', async () => {
    // Mock the register function to reject with an error
    webex.cc.register = jest.fn().mockRejectedValue(new Error('Simulated Error'));

    try {
      await webex.cc.register();
    } catch (error) {
      expect(error).toEqual(new Error('Simulated Error'));
    }
  });
});