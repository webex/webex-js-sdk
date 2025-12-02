# Phone Number Lookup - Usage Examples

This document provides comprehensive examples demonstrating how to use the `lookupByPhoneNumbers()` method in various real-world scenarios.

## Table of Contents
1. [Basic Setup](#basic-setup)
2. [Single Phone Number Lookup](#single-phone-number-lookup)
3. [Multiple Phone Numbers Lookup](#multiple-phone-numbers-lookup)
4. [Batching Large Arrays](#batching-large-arrays)
5. [Error Handling](#error-handling)
6. [Integration with UI Components](#integration-with-ui-components)
7. [Phone Number Normalization](#phone-number-normalization)

---

## Basic Setup

First, ensure the DSS plugin is registered:

```javascript
import '@webex/internal-plugin-dss';
import WebexCore from '@webex/webex-core';

const webex = new WebexCore({
  credentials: {
    access_token: process.env.WEBEX_TOKEN
  }
});

// Register DSS plugin to enable Mercury events
await webex.internal.dss.register();
```

---

## Single Phone Number Lookup

### Example: Lookup incoming caller information

```javascript
async function getCallerInfo(phoneNumber) {
  try {
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers: [phoneNumber]
    });

    if (result.foundArray.length > 0) {
      const contact = result.resultArray[0];
      console.log('Caller:', contact.displayName);
      console.log('Email:', contact.emails?.[0]);
      return contact;
    } else {
      console.log('Unknown number:', phoneNumber);
      return null;
    }
  } catch (error) {
    console.error('Lookup failed:', error);
    return null;
  }
}

// Usage
const caller = await getCallerInfo('+15551234567');
```

---

## Multiple Phone Numbers Lookup

### Example: Resolve participants in a conference call

```javascript
async function resolveConferenceParticipants(phoneNumbers) {
  // Maximum 5 phone numbers per request
  if (phoneNumbers.length > 5) {
    throw new Error('Use batching for more than 5 numbers');
  }

  const result = await webex.internal.dss.lookupByPhoneNumbers({
    phoneNumbers
  });

  // Create a map for easy lookup
  const contactMap = new Map();
  
  result.resultArray.forEach(contact => {
    const phone = contact.phoneNumbers?.[0];
    if (phone) {
      contactMap.set(phone, contact);
    }
  });

  // Return array with resolved and unresolved
  return phoneNumbers.map(phone => {
    if (contactMap.has(phone)) {
      return {
        phoneNumber: phone,
        resolved: true,
        contact: contactMap.get(phone)
      };
    } else {
      return {
        phoneNumber: phone,
        resolved: false,
        contact: null
      };
    }
  });
}

// Usage
const participants = await resolveConferenceParticipants([
  '+15551234567',
  '+442012345678',
  '+33123456789'
]);

participants.forEach(p => {
  if (p.resolved) {
    console.log(`${p.contact.displayName} (${p.phoneNumber})`);
  } else {
    console.log(`Unknown (${p.phoneNumber})`);
  }
});
```

---

## Batching Large Arrays

### Example 1: Sequential batching with progress tracking

```javascript
async function lookupManyPhoneNumbersSequential(phoneNumbers, onProgress) {
  const chunkSize = 5;
  const allResults = {
    resultArray: [],
    foundArray: [],
    notFoundArray: []
  };

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers: chunk
    });

    allResults.resultArray.push(...result.resultArray);
    allResults.foundArray.push(...(result.foundArray || []));
    allResults.notFoundArray.push(...(result.notFoundArray || []));

    // Report progress
    const progress = Math.min(100, ((i + chunkSize) / phoneNumbers.length) * 100);
    if (onProgress) {
      onProgress(progress);
    }
  }

  return allResults;
}

// Usage with progress bar
const phoneNumbers = [/* array of 50 phone numbers */];
const results = await lookupManyPhoneNumbersSequential(
  phoneNumbers,
  (progress) => console.log(`Progress: ${progress.toFixed(0)}%`)
);
```

### Example 2: Parallel batching for faster results

```javascript
async function lookupManyPhoneNumbersParallel(phoneNumbers) {
  const chunkSize = 5;
  const chunks = [];

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    chunks.push(phoneNumbers.slice(i, i + chunkSize));
  }

  // Execute all chunks in parallel
  const results = await Promise.all(
    chunks.map(chunk =>
      webex.internal.dss.lookupByPhoneNumbers({ phoneNumbers: chunk })
    )
  );

  // Merge results
  return {
    resultArray: results.flatMap(r => r.resultArray),
    foundArray: results.flatMap(r => r.foundArray || []),
    notFoundArray: results.flatMap(r => r.notFoundArray || [])
  };
}

// Usage
const phoneNumbers = [/* array of 20 phone numbers */];
const results = await lookupManyPhoneNumbersParallel(phoneNumbers);
console.log(`Found: ${results.foundArray.length}`);
console.log(`Not found: ${results.notFoundArray.length}`);
```

### Example 3: Rate-limited batching

```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function lookupManyPhoneNumbersRateLimited(phoneNumbers, delayMs = 100) {
  const chunkSize = 5;
  const allResults = {
    resultArray: [],
    foundArray: [],
    notFoundArray: []
  };

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers: chunk
    });

    allResults.resultArray.push(...result.resultArray);
    allResults.foundArray.push(...(result.foundArray || []));
    allResults.notFoundArray.push(...(result.notFoundArray || []));

    // Rate limiting delay between batches
    if (i + chunkSize < phoneNumbers.length) {
      await delay(delayMs);
    }
  }

  return allResults;
}
```

---

## Error Handling

### Example: Robust error handling with retries

```javascript
async function lookupWithRetry(phoneNumbers, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await webex.internal.dss.lookupByPhoneNumbers({
        phoneNumbers
      });
    } catch (error) {
      lastError = error;
      
      if (error.message.includes('maximum of 5 phone numbers')) {
        // Don't retry validation errors
        throw error;
      }
      
      if (error.name === 'DssTimeoutError') {
        console.warn(`Timeout on attempt ${attempt + 1}, retrying...`);
        await delay(1000 * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }
      
      // Unknown error, don't retry
      throw error;
    }
  }
  
  throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Usage
try {
  const result = await lookupWithRetry(['+15551234567']);
  console.log('Success:', result);
} catch (error) {
  console.error('All retries failed:', error);
}
```

### Example: Graceful degradation

```javascript
async function lookupWithFallback(phoneNumbers) {
  try {
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers
    });
    
    return {
      success: true,
      contacts: result.resultArray,
      found: result.foundArray,
      notFound: result.notFoundArray
    };
  } catch (error) {
    console.error('Lookup failed:', error);
    
    // Return phone numbers as-is without contact info
    return {
      success: false,
      contacts: phoneNumbers.map(phone => ({
        phoneNumbers: [phone],
        displayName: phone, // Use phone as display name
        id: null
      })),
      found: [],
      notFound: phoneNumbers
    };
  }
}
```

---

## Integration with UI Components

### Example: React component with lookup

```javascript
import React, { useState, useEffect } from 'react';

function ContactResolver({ phoneNumbers, webex }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadContacts() {
      try {
        setLoading(true);
        
        // Batch if needed
        const chunkSize = 5;
        const allContacts = [];
        
        for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
          const chunk = phoneNumbers.slice(i, i + chunkSize);
          const result = await webex.internal.dss.lookupByPhoneNumbers({
            phoneNumbers: chunk
          });
          allContacts.push(...result.resultArray);
        }
        
        setContacts(allContacts);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (phoneNumbers.length > 0) {
      loadContacts();
    }
  }, [phoneNumbers, webex]);

  if (loading) return <div>Loading contacts...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h3>Resolved Contacts</h3>
      <ul>
        {contacts.map((contact, idx) => (
          <li key={idx}>
            {contact.displayName} - {contact.emails?.[0]}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Phone Number Normalization

### Example: Normalize before lookup

```javascript
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove spaces, hyphens, parentheses
  let normalized = phone.trim().replace(/[\s().-]/g, '');
  
  // Ensure it starts with +
  if (!normalized.startsWith('+')) {
    // Add US country code if missing (adjust for your region)
    normalized = '+1' + normalized;
  }
  
  return normalized;
}

async function lookupWithNormalization(rawPhoneNumbers) {
  // Normalize all phone numbers
  const normalizedNumbers = rawPhoneNumbers
    .map(normalizePhoneNumber)
    .filter(phone => phone !== null);

  if (normalizedNumbers.length === 0) {
    return { resultArray: [], foundArray: [], notFoundArray: [] };
  }

  // Enforce max 5
  if (normalizedNumbers.length > 5) {
    throw new Error('Too many phone numbers. Use batching.');
  }

  return await webex.internal.dss.lookupByPhoneNumbers({
    phoneNumbers: normalizedNumbers
  });
}

// Usage
const result = await lookupWithNormalization([
  '(555) 123-4567',    // Will be normalized to +15551234567
  '+44 20 1234 5678',  // Will be normalized to +442012345678
  '555-9999'           // Will be normalized to +15559999
]);
```

---

## Complete End-to-End Example

### Call History with Contact Resolution

```javascript
class CallHistoryManager {
  constructor(webex) {
    this.webex = webex;
    this.contactCache = new Map();
  }

  async initialize() {
    await this.webex.internal.dss.register();
  }

  async resolveCallHistory(callRecords) {
    // Extract unique phone numbers
    const uniquePhones = [...new Set(
      callRecords.map(record => record.phoneNumber)
    )];

    // Lookup contacts in batches
    const contacts = await this.batchLookup(uniquePhones);

    // Map contacts to cache
    contacts.forEach(contact => {
      const phone = contact.phoneNumbers?.[0];
      if (phone) {
        this.contactCache.set(phone, contact);
      }
    });

    // Enrich call records
    return callRecords.map(record => ({
      ...record,
      contact: this.contactCache.get(record.phoneNumber) || null,
      displayName: this.contactCache.get(record.phoneNumber)?.displayName || 
                   record.phoneNumber
    }));
  }

  async batchLookup(phoneNumbers) {
    const chunkSize = 5;
    const allContacts = [];

    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);
      
      try {
        const result = await this.webex.internal.dss.lookupByPhoneNumbers({
          phoneNumbers: chunk
        });
        allContacts.push(...result.resultArray);
      } catch (error) {
        console.error('Batch lookup failed:', error);
        // Continue with other batches
      }
    }

    return allContacts;
  }

  async cleanup() {
    await this.webex.internal.dss.unregister();
  }
}

// Usage
const manager = new CallHistoryManager(webex);
await manager.initialize();

const callRecords = [
  { id: 1, phoneNumber: '+15551234567', timestamp: Date.now(), duration: 120 },
  { id: 2, phoneNumber: '+442012345678', timestamp: Date.now(), duration: 300 },
  { id: 3, phoneNumber: '+15551234567', timestamp: Date.now(), duration: 60 },
];

const enrichedHistory = await manager.resolveCallHistory(callRecords);
console.log('Call History:', enrichedHistory);

await manager.cleanup();
```

---

## Performance Tips

1. **Cache results**: Store resolved contacts to avoid repeated lookups
2. **Batch efficiently**: Use parallel batching for speed, sequential for rate limiting
3. **Normalize once**: Normalize phone numbers before batching to reduce duplicates
4. **Handle errors gracefully**: Always provide fallback display values
5. **Monitor timeouts**: Consider increasing timeout for large batches in slow networks

---

## Testing

### Unit Test Example

```javascript
describe('lookupByPhoneNumbers', () => {
  it('should resolve multiple phone numbers', async () => {
    const result = await webex.internal.dss.lookupByPhoneNumbers({
      phoneNumbers: ['+15551234567', '+442012345678']
    });

    expect(result.resultArray).toBeDefined();
    expect(result.foundArray).toBeDefined();
    expect(result.notFoundArray).toBeDefined();
  });

  it('should reject when more than 5 numbers', async () => {
    await expect(
      webex.internal.dss.lookupByPhoneNumbers({
        phoneNumbers: Array(6).fill('+15551234567')
      })
    ).rejects.toThrow('maximum of 5 phone numbers');
  });
});
```

---

## Additional Resources

- [Directory Search Architecture](./directory-search-architecture.md)
- [Phone Number Lookup Design](./phone-number-lookup-design.md)
- [DSS Mercury Response Structure](./dss-mercury-response-structure.md)
- [Client Implementation Architecture](./client-implementation-architecture.md)
