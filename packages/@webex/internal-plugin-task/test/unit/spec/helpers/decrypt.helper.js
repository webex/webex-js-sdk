import DecryptHelper from "@webex/internal-plugin-task/src/helpers/decrypt.helper";

describe("internal-plugin-task", () => {
  describe("DecryptHelper", () => {
    let ctx;
    let encryptedTaskData;
    let encryptedTasksData;

    beforeEach(() => {
      ctx = {
        webex: {
          internal: {
            encryption: {
              decryptText: jest.fn()
            }
          }
        }
      };

      encryptedTaskData = {
        "id": "abcdabcd-abcd-abcd-abcd-00000000",
        "title": "Encrypted Task Title",
        "notes": "Encrypted Task Notes",
        "encryptionKeyUrl": "/keys/e5d3f747-6adf-432d-999c-6578e33953e3",
      };

      encryptedTasksData = {
        "offset": 0,
        "limit": 100,
        "hasMore": false,
        "items": [
          encryptedTaskData
        ]
      };
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("#decryptTaskResponse - should resolve with undefined if data is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptTaskResponse(ctx, undefined);
      expect(decryptedData).toBeUndefined();
    });

    it("#decryptTaskResponse - should resolve with undefined if data.encryptionKeyUrl is undefined", async () => {
      encryptedTaskData.encryptionKeyUrl = undefined;
      const decryptedData = await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskData);
      expect(decryptedData).toBeUndefined();
    });

    describe("#decryptTaskResponse - should replace encrypted data with decrypted data in response", () => {
      it("should decrypt scheduler data response correctly", async () => {
        const expectedCiphertext = "some decrypted text for testing";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskData);

        expect(encryptedTaskData.title).toBe(expectedCiphertext);
        expect(encryptedTaskData.notes).toBe(expectedCiphertext);
        expect(ctx.webex.internal.encryption.decryptText).toHaveBeenCalled();
      });
    });

    it("#decryptTasksResponse - should resolve with undefined if data is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptTasksResponse(ctx, undefined);
      expect(decryptedData).toBeUndefined();
    });

    it("#decryptTasksResponse - should resolve with undefined if data.items is undefined", async () => {
      const decryptedData = await DecryptHelper.decryptTasksResponse(ctx, {});
      expect(decryptedData).toBeUndefined();
    });

    it("#decryptTasksResponse - should resolve with undefined if data.items is empty", async () => {
      const decryptedData = await DecryptHelper.decryptTasksResponse(ctx, { items: [] });
      expect(decryptedData).toBeUndefined();
    });

    describe("#decryptTasksResponse - should replace encrypted data with decrypted data in response", () => {
      it("should decrypt tasks data response correctly", async () => {
        const expectedCiphertext = "some decrypted text for testing";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTasksResponse(ctx, encryptedTasksData);

        expect(encryptedTasksData.items[0].title).toBe(expectedCiphertext);
        expect(encryptedTasksData.items[0].notes).toBe(expectedCiphertext);
        expect(ctx.webex.internal.encryption.decryptText).toHaveBeenCalled();
      });
    });

    describe("#decryptTaskResponse - should decrypt extendedProperties fields", () => {
      let encryptedTaskWithExtendedProperties;

      beforeEach(() => {
        encryptedTaskWithExtendedProperties = {
          "id": "abcdabcd-abcd-abcd-abcd-00000000",
          "title": "Encrypted Task Title",
          "notes": "Encrypted Task Notes",
          "encryptionKeyUrl": "/keys/e5d3f747-6adf-432d-999c-6578e33953e3",
          "extendedProperties": JSON.stringify({
            "aiAction": {
              "actionType": "SCHEDULE_MEETING",
              "instruction": "Encrypted instruction"
            }
          })
        };
      });

      it("should decrypt extendedProperties instruction field", async () => {
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        const extendedProps = JSON.parse(encryptedTaskWithExtendedProperties.extendedProperties);
        expect(extendedProps.aiAction.instruction).toBe(expectedCiphertext);
        expect(extendedProps.aiAction.actionType).toBe("SCHEDULE_MEETING");
      });

      it("should handle extendedProperties without aiAction", async () => {
        encryptedTaskWithExtendedProperties.extendedProperties = JSON.stringify({
          "otherProp": "value"
        });

        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        const extendedProps = JSON.parse(encryptedTaskWithExtendedProperties.extendedProperties);
        expect(extendedProps.otherProp).toBe("value");
      });

      it("should handle extendedProperties with aiAction but no instruction", async () => {
        encryptedTaskWithExtendedProperties.extendedProperties = JSON.stringify({
          "aiAction": {
            "actionType": "SCHEDULE_MEETING"
          }
        });

        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        const extendedProps = JSON.parse(encryptedTaskWithExtendedProperties.extendedProperties);
        expect(extendedProps.aiAction.actionType).toBe("SCHEDULE_MEETING");
        expect(extendedProps.aiAction.instruction).toBeUndefined();
      });

      it("should handle invalid JSON in extendedProperties", async () => {
        encryptedTaskWithExtendedProperties.extendedProperties = "invalid-json";

        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        expect(encryptedTaskWithExtendedProperties.extendedProperties).toBe("invalid-json");
      });

      it("should handle task without extendedProperties", async () => {
        delete encryptedTaskWithExtendedProperties.extendedProperties;
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        expect(encryptedTaskWithExtendedProperties.title).toBe(expectedCiphertext);
        expect(encryptedTaskWithExtendedProperties.notes).toBe(expectedCiphertext);
      });

      it("should call decryptText with correct parameters for extendedProperties instruction", async () => {
        ctx.webex.internal.encryption.decryptText.mockResolvedValue("decrypted");

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithExtendedProperties);

        expect(ctx.webex.internal.encryption.decryptText).toHaveBeenCalledWith(
          encryptedTaskWithExtendedProperties.encryptionKeyUrl,
          "Encrypted instruction"
        );
      });
    });
  });
});
