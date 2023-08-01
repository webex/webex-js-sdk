import sinon from 'sinon';
import {expect} from '@webex/test-helper-chai';
import EncryptHelper from '@webex/internal-plugin-calendar/src/calendar.encrypt.helper';
describe('internal-plugin-calendar', () => {
  describe('encryptHelper', () => {
    let ctx;
    beforeEach(() => {
      ctx = {
        encryptionKeyUrl: 'http://example.com/encryption-key',
        webex: {
          internal: {
            encryption: {
              encryptText: sinon.stub(),
            },
          },
        },
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('#encryptFreebusyRequestData with emails should ', async () => {
      const freeBusyRequest = {
        start: '20230712T10:20:00Z',
        end: '20230712T20:20:00Z',
        emails: ['test@webex.com'],
      };
      const expectedCiphertext = 'some encrpty data';
      ctx.webex.internal.encryption.encryptText.callsFake((key, ciphertext) =>
        Promise.resolve(expectedCiphertext)
      );
      await EncryptHelper.encryptFreeBusyRequest(ctx, freeBusyRequest);
      expect(freeBusyRequest.emails[0]).to.be.equal(expectedCiphertext);
    });

    it('#encryptFreebusyRequestData not include emails, but include ids- should b', async () => {
      const freeBusyRequest = {
        start: '20230712T10:20:00Z',
        end: '20230712T20:20:00Z',
        userIds: ['91aee1231'],
      };
      const expectedCiphertext = '91aee1231';
      ctx.webex.internal.encryption.encryptText.callsFake((key, ciphertext) =>
        Promise.resolve(expectedCiphertext)
      );
      await EncryptHelper.encryptFreeBusyRequest(ctx, freeBusyRequest);
      expect(freeBusyRequest.userIds[0]).to.equal(expectedCiphertext);
    });
  });
});
