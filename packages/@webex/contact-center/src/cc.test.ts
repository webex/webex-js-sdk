import ContactCenter from './cc';
import Mercury from '@webex/internal-plugin-mercury';
import MockWebex from '@webex/test-helper-mock-webex';
import {Services} from '@webex/webex-core';

describe('CC Tests', () => {
  const webex = new MockWebex({
      children: {
        cc: ContactCenter,
        mercury: Mercury,
        services: Services,
      },
  });

  it('Success: invoke the register function, resolved promise', async () => {
    console.log('mock webex object in test file, ', webex);
    webex.cc.register(true).then((data) => {
        expect(data).toEqual('Success: Dummy data returned');
    })  
  });

  it('Failed: invoke the register function, rejected promise', async () => {
    webex.cc.register(false).catch((error) => {
        expect(error).toBe('Simulated error');
    });    
  });  
});
