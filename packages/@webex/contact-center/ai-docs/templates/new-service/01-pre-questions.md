# New Service - Pre-Questions

> **Purpose**: Gather requirements before generating service code.

---

## Required Information

### 1. Service Identity

**Service Name**: (e.g., "AddressBook", "Queue", "EntryPoint")
- Must be PascalCase
- Will create `src/services/ServiceName.ts`

**Purpose**: (One sentence description)
- What problem does this service solve?
- What data does it manage?

### 2. API Integration

**API Endpoint Base**: (e.g., `/v1/address-books`)

**HTTP Methods Needed**:
- [ ] GET (fetch data)
- [ ] POST (create/search)
- [ ] PUT (update)
- [ ] DELETE (remove)

**API Response Structure**:
```typescript
// Describe expected response shape
type ExpectedResponse = {
  data: [];
  meta?: {
    page: number;
    pageSize: number;
    totalRecords: number;
  };
};
```

### 3. Dependencies

**Requires Agent Profile Data?** (e.g., `addressBookId`, `teamIds`)
- [ ] Yes - specify which fields
- [ ] No

**Requires WebSocket Events?**
- [ ] Yes - specify event types
- [ ] No

### 4. Exposure

**Exposed on ContactCenter?**
- [ ] Yes - `cc.serviceName` (public API)
- [ ] No - internal service only

**Methods to Expose**:
- `getXxx()` - Fetch list
- `getXxxById()` - Fetch single item
- Other methods?

### 5. Caching

**Caching Required?**
- [ ] Yes - in-memory cache
- [ ] No - always fetch fresh

---

## Example Answers (AddressBook)

```
Service Name: AddressBook
Purpose: Manage address book entries for agent speed dial and transfer

API Endpoint: /v1/address-books/{addressBookId}/entries
HTTP Methods: GET
Response: { data: AddressBookEntry[], meta: {...} }

Dependencies: Requires addressBookId from agent profile
WebSocket Events: No

Exposed: Yes, as cc.addressBook
Methods: getEntries(params)
Caching: No
```

---

## Next Step

Once questions are answered, proceed to:
[`02-code-generation.md`](02-code-generation.md)
