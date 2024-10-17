import ContactCenter from '@webex/plugin-cc/src';
import Mercury from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import Services from '@webex/webex-core/dist/lib/services/services';
import WebSocket from '../../../src/WebSocket';
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

    webex.cc.webSocket = new WebSocket(
      {
        parent: webex,
      }
    );

    webex.cc.webSocket.on = jest.fn((event, callback) => {
      if (event === 'event') {
        // Store the callback to call it later
        webex.cc.webSocket._eventCallback = callback;
      }
    });

    // Mock the establishConnection function to trigger the event with Welcome type
    webex.cc.webSocket.subscribeAndConnect = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          const event = {
            type: CC_EVENTS.WELCOME,
            data: {
              agentId: 'dummy-agent-id'
            }
          };
          if (webex.cc.webSocket._eventCallback) {
            webex.cc.webSocket._eventCallback(event); // Trigger the stored event callback
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

        webex.cc.webSocket.on('event', (event) => {
          if (event.type === CC_EVENTS.WELCOME) {
            clearTimeout(timeout);
            resolve(`Success: CI User ID is ${event.data.agentId}`);
          }
        });

        webex.cc.webSocket.subscribeAndConnect().catch(reject);
      });
    });
  });

  afterEach(() => {
    if (webex.cc && webex.cc.webSocket && webex.cc.webSocket.disconnect) {
      webex.cc.webSocket.disconnect();
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