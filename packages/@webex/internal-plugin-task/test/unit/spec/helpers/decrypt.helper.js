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

    describe("#decryptTaskResponse - should decrypt actionItem fields", () => {
      let encryptedTaskWithActionItem;

      beforeEach(() => {
        encryptedTaskWithActionItem = {
          "id": "abcdabcd-abcd-abcd-abcd-00000000",
          "title": "Encrypted Task Title",
          "notes": "Encrypted Task Notes",
          "encryptionKeyUrl": "/keys/e5d3f747-6adf-432d-999c-6578e33953e3",
          "actionItem": {
            "editedContent": "Encrypted edited content",
            "aiGeneratedContent": "Encrypted AI generated content",
            "snippetUUID": "676d5dd3-3d23-450d-a687-0966e06a278a",
            "editor": null,
            "deleted": 0,
            "relatedContext": "",
            "resourceUrl": "https://aibridge-sa1.dmz.webex.com/wbxaibridge/actionitems/snippets/676d5dd3-3d23-450d-a687-0966e06a278a",
            "entities": [
              {
                "text": "Encrypted assignee name",
                "type": "ASSIGNEE",
                "startPos": 0,
                "endPos": 8,
                "metadata": {
                  "email": "encrypted@email.com",
                  "ciUserId": "224c0d39-fda3-4271-9f70-12491b6588bc",
                  "type": null,
                  "instruction": "Encrypted instruction"
                }
              },
              {
                "text": "Encrypted action text",
                "type": "ACTION",
                "startPos": 14,
                "endPos": 55,
                "metadata": {
                  "email": "encrypted@action.com",
                  "ciUserId": null,
                  "type": "create_update_salesforce",
                  "instruction": "Encrypted action instruction"
                }
              }
            ],
            "editedEntities": null
          }
        };
      });

      it("should decrypt actionItem editedContent and aiGeneratedContent", async () => {
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.editedContent).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.aiGeneratedContent).toBe(expectedCiphertext);
      });

      it("should decrypt entities text fields", async () => {
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.entities[0].text).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.entities[1].text).toBe(expectedCiphertext);
      });

      it("should decrypt entities metadata email and instruction fields", async () => {
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.entities[0].metadata.email).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.entities[0].metadata.instruction).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.entities[1].metadata.email).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.entities[1].metadata.instruction).toBe(expectedCiphertext);
      });

      it("should decrypt editedEntities when present", async () => {
        encryptedTaskWithActionItem.actionItem.editedEntities = [
          {
            "text": "Encrypted edited entity",
            "type": "ASSIGNEE",
            "metadata": {
              "email": "encrypted@edited.com",
              "instruction": "Encrypted edited instruction"
            }
          }
        ];

        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.editedEntities[0].text).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.editedEntities[0].metadata.email).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.editedEntities[0].metadata.instruction).toBe(expectedCiphertext);
      });

      it("should handle actionItem without entities", async () => {
        delete encryptedTaskWithActionItem.actionItem.entities;
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.editedContent).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.actionItem.aiGeneratedContent).toBe(expectedCiphertext);
      });

      it("should handle actionItem with null metadata fields", async () => {
        encryptedTaskWithActionItem.actionItem.entities[0].metadata.email = null;
        encryptedTaskWithActionItem.actionItem.entities[0].metadata.instruction = null;

        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.actionItem.entities[0].text).toBe(expectedCiphertext);
      });

      it("should handle task without actionItem", async () => {
        delete encryptedTaskWithActionItem.actionItem;
        const expectedCiphertext = "decrypted text";
        ctx.webex.internal.encryption.decryptText.mockResolvedValue(expectedCiphertext);

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(encryptedTaskWithActionItem.title).toBe(expectedCiphertext);
        expect(encryptedTaskWithActionItem.notes).toBe(expectedCiphertext);
      });

      it("should call decryptText with correct parameters for actionItem fields", async () => {
        ctx.webex.internal.encryption.decryptText.mockResolvedValue("decrypted");

        await DecryptHelper.decryptTaskResponse(ctx, encryptedTaskWithActionItem);

        expect(ctx.webex.internal.encryption.decryptText).toHaveBeenCalledWith(
          encryptedTaskWithActionItem.encryptionKeyUrl,
          "Encrypted edited content"
        );
        expect(ctx.webex.internal.encryption.decryptText).toHaveBeenCalledWith(
          encryptedTaskWithActionItem.encryptionKeyUrl,
          "Encrypted AI generated content"
        );
      });
    });
  });
});
