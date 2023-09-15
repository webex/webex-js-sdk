import sinon from "sinon";
import { expect } from "@webex/test-helper-chai";
import DecryptHelper from "@webex/internal-plugin-calendar/src/calendar.decrypt.helper";

describe("internal-plugin-calendar", () => {
  describe("DecryptHelper", () => {
    let ctx;
    let encryptedSchedulerData;
    let encryptedFreeBusyData;

    beforeEach(() => {
      ctx = {
        webex: {
          internal: {
            encryption: {
              decryptText: sinon.stub()
            }
          }
        }
      };

      encryptedSchedulerData = {
        encryptionKeyUrl: "http://example.com/encryption-key",
        encryptedSubject: "some encrypted subject",
        encryptedLocation: "some encrypted location",
        encryptedNotes: "some encrypted notes",
        encryptedParticipants: [
          {
            encryptedEmailAddress: "some encrypted email address",
            encryptedName: "some encrypted name"
          },
          {
            encryptedEmailAddress: "another encrypted email address",
            encryptedName: "another encrypted name"
          }
        ],
        encryptedScheduleFor: {
          "user1@example.com": {
            encryptedEmail: "some encrypted email address",
            encryptedDisplayName: "some encrypted display name"
          },
          "user2@example.com": {
            encryptedEmail: "another encrypted email address",
            encryptedDisplayName: "another encrypted display name"
          }
        },
        meetingJoinInfo: {
          meetingJoinURI: "some encrypted meeting join URI",
          meetingJoinURL: "some encrypted meeting join URL"
        },
        encryptedOrganizer: {
          encryptedEmailAddress: "some encrypted email address",
          encryptedName: "some encrypted name"
        },
        webexURI: "some encrypted webex URI",
        webexURL: "some encrypted webex URL",
        spaceMeetURL: "some encrypted space meet URL",
        spaceURI: "some encrypted space URI",
        spaceURL: "some encrypted space URL"
      };

      encryptedFreeBusyData = {
        calendarFreeBusyScheduleResponse: {
          encryptionKeyUrl: "https://encryption.key/url",
          calendarFreeBusyItems: [
            {
              email: "encrypted-email"
            }
          ]
        }
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it("#decryptSchedulerDataResponse - should resolve with undefined if data is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptSchedulerDataResponse(ctx, undefined);
      expect(decryptedData).to.be.undefined;
    });

    it("#decryptSchedulerDataResponse - should resolve with undefined if data.encryptionKeyUrl is undefined", async () => {
      encryptedSchedulerData.encryptionKeyUrl = undefined;
      const decryptedData = await DecryptHelper.decryptSchedulerDataResponse(ctx, encryptedSchedulerData);
      expect(decryptedData).to.be.undefined;
    });

    describe("#decryptSchedulerDataResponse - should replace encrypted data with decrypted data in response", () => {
      it("should decrypt scheduler data response correctly", async () => {
        // Stub the decryption method to return the plaintext value.
        const expectedCiphertext = "some decrypted text for testing";

        ctx.webex.internal.encryption.decryptText.callsFake((key, ciphertext) => Promise.resolve(expectedCiphertext));

        // Decrypt the data.
        await DecryptHelper.decryptSchedulerDataResponse(ctx, encryptedSchedulerData);

        // Check that all encrypted properties were decrypted correctly.
        expect(encryptedSchedulerData.encryptedSubject).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedLocation).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedNotes).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedParticipants[0].encryptedEmailAddress).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedParticipants[0].encryptedName).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedScheduleFor["user1@example.com"].encryptedEmail).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedScheduleFor["user1@example.com"].encryptedDisplayName).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.meetingJoinInfo.meetingJoinURI).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.meetingJoinInfo.meetingJoinURL).to.equal(expectedCiphertext);

        expect(encryptedSchedulerData.encryptedOrganizer.encryptedEmailAddress).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.encryptedOrganizer.encryptedName).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.webexURI).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.webexURL).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.spaceMeetURL).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.spaceURI).to.equal(expectedCiphertext);
        expect(encryptedSchedulerData.spaceURL).to.equal(expectedCiphertext);
      });
    });

    it("#decryptFreeBusyResponse - should resolve with undefined if data is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptFreeBusyResponse(ctx, undefined);
      expect(decryptedData).to.be.undefined;
    });

    it("#decryptFreeBusyResponse - should resolve with undefined if data.calendarFreeBusyScheduleResponse is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptFreeBusyResponse(ctx, {});
      expect(decryptedData).to.be.undefined;
    });

    it("#decryptFreeBusyResponse - should resolve with undefined if data.calendarFreeBusyScheduleResponse.encryptionKeyUrl is undefined", async () => {
      encryptedFreeBusyData.calendarFreeBusyScheduleResponse.encryptionKeyUrl = undefined;
      const decryptedData = await DecryptHelper.decryptFreeBusyResponse(ctx, encryptedFreeBusyData);
      expect(decryptedData).to.be.undefined;
    });

    it("#decryptFreeBusyResponse - should replace encrypted email with decrypted email in calendarFreeBusyItems", async () => {
      const decryptTextStub = ctx.webex.internal.encryption.decryptText;
      decryptTextStub.resolves("decrypted-email");

      await DecryptHelper.decryptFreeBusyResponse(ctx, encryptedFreeBusyData);

      expect(encryptedFreeBusyData.calendarFreeBusyScheduleResponse.calendarFreeBusyItems[0].email).to.equal("decrypted-email");
    });
  });
});
