import ContactCenter from 'packages/@webex/plugin-cc/src';
import Mercury from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import {Services} from '@webex/webex-core';

describe('CC Tests', () => {
  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cc: ContactCenter,
        mercury: Mercury,
        services: Services,
      },
    });
  })

  it('Success: invoke the register function, resolved promise', () => {
    webex.cc.register(true).then((data) => {
        expect(data).toEqual('Success: Dummy data returned');
    })
  });

  it('Failed: invoke the register function, rejected promise', () => {
    webex.cc.register(false).catch((error) => {
        expect(error).toEqual(new Error('Simulated Error'));
    });
  });
});
