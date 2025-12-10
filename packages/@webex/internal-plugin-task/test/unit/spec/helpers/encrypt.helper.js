import EncryptHelper from '@webex/internal-plugin-task/src/helpers/encrypt.helper';

describe('internal-plugin-task', () => {
  describe('encryptHelper', () => {
    let ctx;

    beforeEach(() => {
      ctx = {
        webex: {
          internal: {
            encryption: {
              encryptText: jest.fn(),
              kms: {
                createUnboundKeys: jest.fn().mockResolvedValue([{
                  uri: 'kmsKeyUri',
                }]),
              }
            },
          },
        },
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('#encryptTaskRequest with plain text fields', async () => {
      const taskRequest = {
        "title": "plain text title",
        "notes": "plain text notes",
      };
      const expectedCiphertext = 'some encrpty data';
      ctx.webex.internal.encryption.encryptText.mockResolvedValue(expectedCiphertext);

      await EncryptHelper.encryptTaskRequest(ctx, taskRequest);

      expect(taskRequest.title).toBe(expectedCiphertext);
      expect(taskRequest.notes).toBe(expectedCiphertext);
      expect(ctx.webex.internal.encryption.encryptText).toHaveBeenCalled();
    });
  });
});
