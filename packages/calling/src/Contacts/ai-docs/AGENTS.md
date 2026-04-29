# Contacts Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **How to proceed:**
  - For changes within the `Contacts/` directory, use this file as your primary reference.
  - For encryption-related changes, review the `encryptedFields` enum in `constants.ts` and the encrypt/decrypt methods in `ContactsClient.ts`.
  - For SCIM resolution of CLOUD contacts, review `resolveCloudContacts` and the `scimQuery` utility in `common/Utils.ts`.
  - For common types (`Address`, `PhoneNumber`, `URIAddress`, `SCIMListResponse`), refer to `common/types.ts`.
- **Important:** Load this module-specific doc first, then drill into source files as needed.

---

## Overview

The `ContactsClient` module provides APIs for managing personal contacts and contact groups within the Webex ecosystem. It handles CRUD operations for contacts (both CUSTOM and CLOUD types), contact group management, and transparently encrypts/decrypts contact data using Webex KMS (Key Management Service). CLOUD contacts are resolved via SCIM (System for Cross-domain Identity Management) queries.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/Contacts/ContactsClient.ts`

**Factory:** `createContactsClient(webex, logger) -> IContacts`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **Fetch Contacts & Groups** | Retrieves all contacts and contact groups for the user, decrypting CUSTOM contacts and resolving CLOUD contacts via SCIM in batches of 50. |
| **Create Contact** | Creates a new CUSTOM or CLOUD contact with transparent encryption. Auto-assigns to default group if none specified. |
| **Delete Contact** | Deletes a contact by contactId and removes it from the local cache. |
| **Create Contact Group** | Creates a new contact group with an encrypted display name. Auto-creates KMS Resource Object if no encryption key exists. Prevents duplicate group names. |
| **Delete Contact Group** | Deletes a contact group by groupId and removes it from the local cache. |
| **Encryption/Decryption** | Transparently encrypts and decrypts contact fields: `displayName`, `firstName`, `lastName`, `emails`, `phoneNumbers`, `sipAddresses`, `addressInfo`, `avatarURL`, `companyName`, `title`. |
| **CLOUD Contact Resolution** | Resolves CLOUD contacts via SCIM to fetch display names, phone numbers, SIP addresses, department, manager, and avatar information. Processes in batches of 50. |
| **Default Group Management** | Automatically creates a default "Other contacts" group when no groups exist. |

---

## Public API

### IContacts Interface

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `getContacts` | `(): Promise<ContactResponse>` | Fetch all contacts and groups |
| `createContact` | `(contactInfo: Contact): Promise<ContactResponse>` | Create a new contact |
| `deleteContact` | `(contactId: string): Promise<ContactResponse>` | Delete a contact |
| `createContactGroup` | `(displayName: string, encryptionKeyUrl?: string, groupType?: GroupType): Promise<ContactResponse>` | Create a contact group |
| `deleteContactGroup` | `(groupId: string): Promise<ContactResponse>` | Delete a contact group |
| `getSDKConnector` | `(): ISDKConnector` | Returns the SDK connector singleton |

### Key Types

#### ContactType Enum

| Value | Description |
| ----- | ----------- |
| `CUSTOM` | User-created custom contact with encrypted fields |
| `CLOUD` | Cloud-based contact resolved via SCIM |

#### GroupType Enum

| Value | Description |
| ----- | ----------- |
| `NORMAL` | Standard contact group |
| `EXTERNAL` | External contact group |

#### Contact

```typescript
type Contact = {
  addressInfo?: Address;
  avatarURL?: string;
  avatarUrlDomain?: string;
  companyName?: string;
  contactId: string;
  contactType: ContactType;
  department?: string;
  displayName?: string;
  emails?: URIAddress[];
  encryptionKeyUrl: string;
  firstName?: string;
  groups: string[];
  kmsResourceObjectUrl?: string;
  lastName?: string;
  manager?: string;
  ownerId?: string;
  phoneNumbers?: PhoneNumber[];
  primaryContactMethod?: string;
  schemas?: string;
  sipAddresses?: URIAddress[];
  resolved: boolean;
};
```

#### ContactResponse

```typescript
type ContactResponse = {
  statusCode: number;
  data: {
    contacts?: Contact[];
    groups?: ContactGroup[];
    contact?: Contact;
    group?: ContactGroup;
    error?: string;
  };
  message: string | null;
};
```

---

## Configuration

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | Initialized Webex SDK with access to `internal.encryption`, `internal.encryption.kms`, and `internal.services` |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |

The `contactsServiceUrl` is automatically resolved from `webex.internal.services._serviceUrls.contactsService`.

---

## Examples and Use Cases

### Create a ContactsClient

```typescript
import {createContactsClient} from '@webex/calling';

const contactClient = createContactsClient(webex, {level: 'info'});
```

### Fetch All Contacts and Groups

```typescript
const response = await contactClient.getContacts();
if (response.statusCode === 200) {
  console.log('Contacts:', response.data.contacts);
  console.log('Groups:', response.data.groups);
}
```

### Create a Custom Contact

```typescript
const response = await contactClient.createContact({
  contactType: ContactType.CUSTOM,
  displayName: 'Jane Doe',
  firstName: 'Jane',
  lastName: 'Doe',
  emails: [{type: 'work', value: 'jane@example.com'}],
  phoneNumbers: [{type: 'mobile', value: '+15551234567'}],
});
```

### Create a Cloud Contact

```typescript
const response = await contactClient.createContact({
  contactType: ContactType.CLOUD,
  contactId: 'scim-user-uuid',
});
```

### Delete a Contact

```typescript
await contactClient.deleteContact('contact-uuid');
```

### Create and Delete Contact Groups

```typescript
const groupResponse = await contactClient.createContactGroup('Work Colleagues');
const groupId = groupResponse.data.group?.groupId;

await contactClient.deleteContactGroup(groupId);
```

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
| ------- | ------- |
| `webex` (SDK) | HTTP requests, KMS encryption/decryption, SCIM queries, service URL resolution |

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `SDKConnector` | Singleton bridge to Webex SDK |
| `Logger` | Structured logging with file/method context |
| `scimQuery` | Utility for querying SCIM to resolve CLOUD contacts |
| `serviceErrorCodeHandler` | Standardized error response formatting |
| `uploadLogs` | Uploads diagnostic logs on errors |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams
