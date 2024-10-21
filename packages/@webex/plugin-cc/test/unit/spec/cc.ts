import ContactCenter from '@webex/plugin-cc/src';
import MockWebex from '@webex/test-helper-mock-webex';
import WebSocket from '../../../src/WebSocket';
import { READY } from '../../../src/constants';
import { CC_EVENTS } from '../../../src/types';

describe('CC Tests', () => {
  let webex;

  beforeEach(() => {
    console.log('Initializing MockWebex...');
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
      },
    });

    // Mock necessary properties and methods for Services
    webex.internal = {
      services: {
        get: jest.fn().mockReturnValue('dummy-wcc-api-url'),
      },
    };

    webex.cc.webSocket = new WebSocket({
      parent: webex,
    });

    // Mock the 'on' method to capture event callbacks
    webex.cc.webSocket.on = jest.fn((event, callback) => {
      if (event === 'event') {
        console.log('Registering event callback...');
        // Store the callback to call it later
        webex.cc.webSocket._eventCallback = callback;
      }
    });

    // Trigger the READY event
    console.log('Triggering READY event...');
    webex.emit(READY);
  });

  afterEach(() => {
    console.log('Cleaning up after test...');
    if (webex.cc && webex.cc.webSocket && webex.cc.webSocket.disconnect) {
      webex.cc.webSocket.disconnect();
    }
  });

  it('Success: invoke the register function, resolved promise', async () => {
    console.log('Mocking subscribeAndConnect for success scenario...');
    // Mock the subscribeAndConnect function to directly fire the event with Welcome type
    webex.cc.webSocket.subscribeAndConnect = jest.fn(() => {
      const event = {
        type: CC_EVENTS.WELCOME,
        data: {
          agentId: 'dummy-agent-id'
        }
      };
      if (webex.cc.webSocket._eventCallback) {
        console.log('Firing WELCOME event...');
        webex.cc.webSocket._eventCallback(event); // Trigger the stored event callback
      }
    });

    console.log('Calling register function...');
    const res = await webex.cc.register();
    console.log('Register function resolved:', res);
    expect(res).toEqual('Success: CI User ID is dummy-agent-id');
  }, 10000); // Increase the timeout to 10 seconds

  it('Failed: invoke the register function, rejected promise', async () => {
    console.log('Mocking subscribeAndConnect for failure scenario...');
    // Mock the subscribeAndConnect function to simulate a timeout by doing nothing
    webex.cc.webSocket.subscribeAndConnect = jest.fn();

    console.log('Calling register function...');
    try {
      await webex.cc.register();
      // If the register call doesn't throw, we need to fail the test
      throw new Error('The register function should have thrown an error');
    } catch (error) {
      console.log('Register function threw an error:', error);
      expect(error).toEqual(new Error('Subscription Failed: Time out'));
    }
  });
});