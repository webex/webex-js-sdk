# DSS Client Usage Examples

**Package:** `@webex/internal-plugin-dss`  
**Audience:** Client application developers  
**Last Updated:** December 2025

---

## Table of Contents

1. [Important Notice](#important-notice)
2. [Quick Start](#quick-start)
3. [Common Use Cases](#common-use-cases)
4. [Advanced Patterns](#advanced-patterns)
5. [React Integration](#react-integration)
6. [Production Considerations](#production-considerations)
7. [Helper Utilities](#helper-utilities)
8. [Complete Examples](#complete-examples)

---

## Important Notice

⚠️ **Internal Plugin Warning**

`@webex/internal-plugin-dss` is an **internal plugin**. While it can be used by applications consuming the Webex JS SDK, its API and behavior may change without semver guarantees. Use in production only if your application can tolerate potential non-backward compatible changes.

---

## Quick Start

### Installation & Setup

```javascript
import '@webex/internal-plugin-dss';
import WebexCore from '@webex/webex-core';

// Initialize with access token
const webex = new WebexCore({
  credentials: {
    access_token: process.env.WEBEX_ACCESS_TOKEN
  }
});

// Register DSS plugin to enable Mercury events
await webex.internal.dss.register();

// When done
await webex.internal.dss.unregister();
```

### Device Registration (Optional)

While device registration happens automatically, you can trigger it explicitly to surface errors early:

```javascript
// Optional: Register device explicitly
await webex.internal.device.register();

// Now device.url and orgId are available
console.log('Device URL:', webex.internal.device.url);
console.log('Org ID:', webex.internal.device.orgId);

// Then register DSS
await webex.internal.dss.register();
```

---

## Common Use Cases

### Use Case 1: Email-Based Contact Lookup

Resolve contact information from email address (e.g., for email client integration):

```javascript
async function lookupContactByEmail(emailAddress) {
  try {
    const contact = await webex.internal.dss.lookupByEmail({
      email: emailAddress
    });

    if (contact) {
      return {
        name: contact.displayName,
        email: contact.emails?.[0] || emailAddress,
        phoneNumbers: contact.phoneNumbers || [],
        id: contact.id,
        type: contact.type, // PERSON, ROOM, etc.
        found: true
      };
    } else {
      return {
        name: emailAddress,
        email: emailAddress,
        found: false
      };
    }
  } catch (error) {
    console.error('Email lookup failed:', error);
    return {
      name: emailAddress,
      email: emailAddress,
      found: false,
      error: error.message
    };
  }
}

// Usage
const contact = await lookupContactByEmail('john.doe@example.com');
console.log(`Contact: ${contact.name} (${contact.email})`);
if (contact.phoneNumbers.length > 0) {
  console.log(`Phone: ${contact.phoneNumbers[0]}`);
}
```

### Use Case 2: Incoming Caller Identification

Display caller information when receiving a phone call:

```javascript
async function identifyIncomingCaller(phoneNumber) {
  try {
    const result = await webex.internal.dss.lookupByPhoneNumbers([phoneNumber]);

    if (result.foundArray.length > 0) {
      const contact = result.resultArray[0];
      return {
        name: contact.displayName,
        email: contact.emails?.[0] || 'No email',
        phoneNumbers: contact.phoneNumbers || [],
        type: contact.type, // PERSON, ROOM, etc.
        found: true
      };
    } else {
      return {
        name: phoneNumber,
        found: false
      };
    }
  } catch (error) {
    console.error('Caller lookup failed:', error);
    return {
      name: phoneNumber,
      found: false,
      error: error.message
    };
  }
}

// Usage
const caller = await identifyIncomingCaller('+15551234567');
console.log(`Incoming call from: ${caller.name}`);
```

### Use Case 3: Conference Call Participants (Phone Numbers)

Resolve all participants in a conference call:

```javascript
async function resolveConferenceParticipants(phoneNumbers) {
  // Validate input
  if (phoneNumbers.length > 5) {
    throw new Error('Use batching helper for more than 5 participants');
  }

  const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);

  // Create a lookup map for matching
  const contactMap = new Map();
  result.resultArray.forEach(contact => {
    const phone = contact.phoneNumbers?.[0];
    if (phone) {
      contactMap.set(phone, contact);
    }
  });

  // Return structured participant list
  return phoneNumbers.map(phone => ({
    phoneNumber: phone,
    contact: contactMap.get(phone) || null,
    displayName: contactMap.get(phone)?.displayName || phone,
    resolved: contactMap.has(phone)
  }));
}

// Usage
const participants = await resolveConferenceParticipants([
  '+15551234567',
  '+442012345678',
  '+33123456789'
]);

participants.forEach(p => {
  const status = p.resolved ? '✓' : '✗';
  console.log(`${status} ${p.displayName} (${p.phoneNumber})`);
});
```

### Use Case 4: Email Thread Participants Resolution

Enrich email thread with contact details:

```javascript
async function resolveEmailParticipants(emailAddresses) {
  const contactMap = new Map();

  // Lookup each email individually (lookupByEmail returns single contact)
  for (const email of emailAddresses) {
    try {
      const contact = await webex.internal.dss.lookupByEmail({ email });
      if (contact) {
        contactMap.set(email, contact);
      }
    } catch (error) {
      console.error(`Failed to lookup ${email}:`, error);
    }
  }

  // Return structured participant list
  return emailAddresses.map(email => ({
    email,
    contact: contactMap.get(email) || null,
    displayName: contactMap.get(email)?.displayName || email,
    resolved: contactMap.has(email)
  }));
}

// Usage
const participants = await resolveEmailParticipants([
  'john.doe@example.com',
  'jane.smith@example.com',
  'bob@external.com'
]);

participants.forEach(p => {
  const status = p.resolved ? '✓' : '✗';
  console.log(`${status} ${p.displayName} <${p.email}>`);
});
```

### Use Case 5: Call History Resolution

Enrich call history with contact information:

```javascript
async function enrichCallHistory(callRecords) {
  // Extract unique phone numbers
  const uniquePhones = [...new Set(
    callRecords.map(record => record.phoneNumber)
  )];

  // Batch lookup all unique numbers
  const contacts = await batchLookupPhoneNumbers(uniquePhones);

  // Create contact map
  const contactMap = new Map();
  contacts.forEach(contact => {
    const phone = contact.phoneNumbers?.[0];
    if (phone) contactMap.set(phone, contact);
  });

  // Enrich call records
  return callRecords.map(record => ({
    ...record,
    contact: contactMap.get(record.phoneNumber) || null,
    displayName: contactMap.get(record.phoneNumber)?.displayName || 
                 record.phoneNumber
  }));
}

// Helper: batch lookup (handles >5 numbers)
async function batchLookupPhoneNumbers(phoneNumbers) {
  const chunkSize = 5;
  const allContacts = [];

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    try {
      const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);
      allContacts.push(...result.resultArray);
    } catch (error) {
      console.error(`Batch ${i / chunkSize + 1} failed:`, error);
    }
  }

  return allContacts;
}

// Usage
const callHistory = [
  { id: 1, phoneNumber: '+15551234567', duration: 120, timestamp: Date.now() },
  { id: 2, phoneNumber: '+442012345678', duration: 300, timestamp: Date.now() },
  { id: 3, phoneNumber: '+15551234567', duration: 60, timestamp: Date.now() }
];

const enrichedHistory = await enrichCallHistory(callHistory);
console.log('Enriched History:', enrichedHistory);
```

---

## Advanced Patterns

### Pattern 1: Retry with Exponential Backoff

Handle transient failures gracefully:

```javascript
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
### Pattern 2: Graceful Degradation

Always provide a fallback when lookups fail:

```javascript
// Phone number lookup with fallback
async function lookupPhoneWithFallback(phoneNumbers) {
  try {
    const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);
    
    return {
      success: true,
      contacts: result.resultArray,
      found: result.foundArray,
      notFound: result.notFoundArray
    };
  } catch (error) {
    console.error('Phone lookup failed, using fallback:', error);
    
    // Return phone numbers as basic contact objects
    return {
      success: false,
      contacts: phoneNumbers.map(phone => ({
        phoneNumbers: [phone],
        displayName: phone, // Use phone as display name
        id: null,
        type: 'UNKNOWN'
      })),
      found: [],
      notFound: phoneNumbers,
      error: error.message
    };
  }
}

// Email lookup with fallback
async function lookupEmailWithFallback(email) {
  try {
    const contact = await webex.internal.dss.lookupByEmail({ email });
    
    if (contact) {
      return {
        success: true,
        contact,
        found: true
      };
    } else {
      // Not found
      return {
        success: true,
        contact: {
          emails: [email],
          displayName: email,
          id: null,
          type: 'UNKNOWN'
        },
        found: false
      };
    }
  } catch (error) {
    console.error('Email lookup failed, using fallback:', error);
    
    return {
      success: false,
      contact: {
        emails: [email],
        displayName: email,
        id: null,
        type: 'UNKNOWN'
      },
      found: false,
      error: error.message
    };
  }
}

// Usage
const phoneResult = await lookupPhoneWithFallback(['+15551234567', '+442012345678']);
if (!phoneResult.success) {
  console.warn('Using phone fallback data due to:', phoneResult.error);
}

const emailResult = await lookupEmailWithFallback('john.doe@example.com');
if (!emailResult.success) {
  console.warn('Using email fallback data due to:', emailResult.error);
}
```
```

### Pattern 2: Graceful Degradation

Always provide a fallback when lookups fail:

```javascript
async function lookupWithFallback(phoneNumbers) {
  try {
    const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);
    
    return {
      success: true,
      contacts: result.resultArray,
      found: result.foundArray,
      notFound: result.notFoundArray
    };
  } catch (error) {
    console.error('Lookup failed, using fallback:', error);
    
    // Return phone numbers as basic contact objects
    return {
      success: false,
      contacts: phoneNumbers.map(phone => ({
        phoneNumbers: [phone],
        displayName: phone, // Use phone as display name
        id: null,
        type: 'UNKNOWN'
      })),
      found: [],
      notFound: phoneNumbers,
      error: error.message
    };
  }
}

// Usage
const result = await lookupWithFallback(['+15551234567', '+442012345678']);
if (!result.success) {
  console.warn('Using fallback data due to:', result.error);
}
```

### Pattern 3: Rate-Limited Batching

Throttle requests to avoid overwhelming the backend:

```javascript
async function lookupManyWithRateLimit(phoneNumbers, delayMs = 200) {
  const chunkSize = 5;
  const allResults = {
    resultArray: [],
    foundArray: [],
    notFoundArray: []
  };

  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    const chunk = phoneNumbers.slice(i, i + chunkSize);
    
    try {
      const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);

      allResults.resultArray.push(...result.resultArray);
      allResults.foundArray.push(...result.foundArray);
      allResults.notFoundArray.push(...result.notFoundArray);

      // Rate limiting delay between batches (skip on last batch)
      if (i + chunkSize < phoneNumbers.length) {
        await delay(delayMs);
      }
    } catch (error) {
      console.error(`Batch starting at index ${i} failed:`, error);
      // Continue with remaining batches
    }
  }

  return allResults;
}

// Usage
const result = await lookupManyWithRateLimit(
  Array(20).fill('+15551234567'), // 20 numbers
  200 // 200ms between batches
);
```

### Pattern 4: Parallel Batching for Speed

Maximize throughput with parallel requests:

```javascript
async function lookupManyParallel(phoneNumbers, maxConcurrency = 3) {
  const chunkSize = 5;
  const chunks = [];

  // Split into chunks
  for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
    chunks.push(phoneNumbers.slice(i, i + chunkSize));
  }

  // Process chunks with concurrency limit
  const results = [];
  for (let i = 0; i < chunks.length; i += maxConcurrency) {
    const batch = chunks.slice(i, i + maxConcurrency);
    const batchResults = await Promise.all(
      batch.map(chunk => 
        webex.internal.dss.lookupByPhoneNumbers(chunk)
          .catch(error => {
            console.error('Chunk failed:', error);
            return { resultArray: [], foundArray: [], notFoundArray: [] };
          })
      )
    );
    results.push(...batchResults);
  }

  // Merge all results
  return {
    resultArray: results.flatMap(r => r.resultArray),
    foundArray: results.flatMap(r => r.foundArray),
    notFoundArray: results.flatMap(r => r.notFoundArray)
  };
}

// Usage
const result = await lookupManyParallel(
  Array(30).fill('+15551234567'), // 30 numbers
  3 // Max 3 concurrent requests
);
```

### Pattern 5: Sequential Batching with Progress

Show progress for large lookups:

```javascript
async function lookupManyWithProgress(phoneNumbers, onProgress) {
  const chunkSize = 5;
## React Integration

### Example 1: Phone Number Contact Resolver Component

```javascript
import React, { useState, useEffect } from 'react';

function PhoneContactResolver({ phoneNumbers, webex }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadContacts() {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        setContacts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Batch if needed
        const chunkSize = 5;
        const allContacts = [];
        
        for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
          const chunk = phoneNumbers.slice(i, i + chunkSize);
          const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);
          allContacts.push(...result.resultArray);
        }
        
        setContacts(allContacts);
      } catch (err) {
        console.error('Contact lookup failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadContacts();
  }, [phoneNumbers, webex]);

  if (loading) {
    return <div className="loading">Loading contacts...</div>;
  }

  if (error) {
    return <div className="error">Error loading contacts: {error}</div>;
  }

  if (contacts.length === 0) {
    return <div className="empty">No contacts found</div>;
  }

  return (
    <div className="contact-list">
      <h3>Resolved Contacts ({contacts.length})</h3>
      <ul>
        {contacts.map((contact, idx) => (
          <li key={idx}>
            <strong>{contact.displayName}</strong>
            {contact.emails?.[0] && <span> • {contact.emails[0]}</span>}
            {contact.phoneNumbers?.[0] && <span> • {contact.phoneNumbers[0]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PhoneContactResolver;
```

### Example 3: Phone Number Lookup Hook

```javascript
import { useState, useEffect } from 'react';

function usePhoneLookup(webex, phoneNumbers) {
  const [state, setState] = useState({
    contacts: [],
    loading: true,
    error: null,
    found: [],
    notFound: []
  });

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        setState({ contacts: [], loading: false, error: null, found: [], notFound: [] });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Batch lookup
        const chunkSize = 5;
        const allResults = {
          resultArray: [],
          foundArray: [],
          notFoundArray: []
        };
        
        for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
          if (cancelled) return;
          
          const chunk = phoneNumbers.slice(i, i + chunkSize);
          const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);
          
          allResults.resultArray.push(...result.resultArray);
          allResults.foundArray.push(...result.foundArray);
          allResults.notFoundArray.push(...result.notFoundArray);
        }
        
        if (!cancelled) {
          setState({
            contacts: allResults.resultArray,
            loading: false,
            error: null,
            found: allResults.foundArray,
            notFound: allResults.notFoundArray
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err.message
          }));
        }
      }
    }

    lookup();

    return () => {
      cancelled = true;
    };
  }, [webex, phoneNumbers]);

  return state;
}

// Usage in component
function PhoneListComponent({ webex, phoneNumbers }) {
  const { contacts, loading, error, found, notFound } = usePhoneLookup(
    webex, 
    phoneNumbers
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Found: {found.length}, Not found: {notFound.length}</p>
      {contacts.map(contact => (
        <div key={contact.id}>{contact.displayName}</div>
      ))}
    </div>
  );
}
```

### Example 4: Email Lookup Hook

```javascript
import { useState, useEffect } from 'react';

function useEmailLookup(webex, emailAddresses) {
  const [state, setState] = useState({
    contacts: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!emailAddresses || emailAddresses.length === 0) {
        setState({ contacts: [], loading: false, error: null });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Lookup all emails in parallel
        const contactPromises = emailAddresses.map(email =>
          webex.internal.dss.lookupByEmail({ email })
            .then(contact => ({
              email,
              contact: contact || null,
              found: !!contact
            }))
            .catch(err => {
              console.error(`Failed to lookup ${email}:`, err);
              return { email, contact: null, found: false, error: err.message };
            })
        );
        
        const results = await Promise.all(contactPromises);
        
        if (!cancelled) {
          setState({
            contacts: results,
            loading: false,
            error: null
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err.message
          }));
        }
      }
    }

    lookup();

    return () => {
      cancelled = true;
    };
  }, [webex, emailAddresses]);

  return state;
}

// Usage in component
function EmailListComponent({ webex, emailAddresses }) {
  const { contacts, loading, error } = useEmailLookup(webex, emailAddresses);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  const foundCount = contacts.filter(c => c.found).length;
  const notFoundCount = contacts.length - foundCount;

  return (
    <div>
      <p>Found: {foundCount}, Not found: {notFoundCount}</p>
      {contacts.map((item, idx) => (
        <div key={idx}>
          {item.contact ? item.contact.displayName : item.email}
          {!item.found && <span> (unresolved)</span>}
        </div>
      ))}
    </div>
  );
}
``` loadContacts();
  }, [phoneNumbers, webex]);

  if (loading) {
    return <div className="loading">Loading contacts...</div>;
  }

  if (error) {
    return <div className="error">Error loading contacts: {error}</div>;
  }

  if (contacts.length === 0) {
    return <div className="empty">No contacts found</div>;
  }

  return (
    <div className="contact-list">
      <h3>Resolved Contacts ({contacts.length})</h3>
      <ul>
        {contacts.map((contact, idx) => (
          <li key={idx}>
            <strong>{contact.displayName}</strong>
            {contact.emails?.[0] && <span> • {contact.emails[0]}</span>}
            {contact.phoneNumbers?.[0] && <span> • {contact.phoneNumbers[0]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ContactResolver;
```

### Example 2: Contact Resolver Hook

```javascript
import { useState, useEffect } from 'react';

function useContactLookup(webex, phoneNumbers) {
  const [state, setState] = useState({
    contacts: [],
    loading: true,
    error: null,
    found: [],
    notFound: []
  });

  useEffect(() => {
    let cancelled = false;

    async function lookup() {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        setState({ contacts: [], loading: false, error: null, found: [], notFound: [] });
        return;
      }

      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Batch lookup
        const chunkSize = 5;
        const allResults = {
          resultArray: [],
          foundArray: [],
          notFoundArray: []
        };
        
        for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
          if (cancelled) return;
          
          const chunk = phoneNumbers.slice(i, i + chunkSize);
          const result = await webex.internal.dss.lookupByPhoneNumbers(chunk);
          
          allResults.resultArray.push(...result.resultArray);
          allResults.foundArray.push(...result.foundArray);
          allResults.notFoundArray.push(...result.notFoundArray);
        }
        
        if (!cancelled) {
          setState({
            contacts: allResults.resultArray,
            loading: false,
            error: null,
            found: allResults.foundArray,
            notFound: allResults.notFoundArray
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err.message
          }));
        }
      }
    }

    lookup();

    return () => {
      cancelled = true;
    };
  }, [webex, phoneNumbers]);

  return state;
}

// Usage in component
function MyComponent({ webex, phoneNumbers }) {
  const { contacts, loading, error, found, notFound } = useContactLookup(
    webex, 
    phoneNumbers
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Found: {found.length}, Not found: {notFound.length}</p>
      {contacts.map(contact => (
        <div key={contact.id}>{contact.displayName}</div>
      ))}
    </div>
  );
}
```

---

## Production Considerations

### Caching Strategy

Implement caching to reduce redundant lookups:

### Email Masking for Logs

```javascript
/**
 * Mask email address for logging (privacy)
 * Shows only domain and first 2 characters
 */
function maskEmailForLog(email) {
  if (!email || !email.includes('@')) {
    return email;
  }
  
  const [localPart, domain] = email.split('@');
  const masked = localPart.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

// Usage
console.log(`Looking up: ${maskEmailForLog('john.doe@example.com')}`);
// Output: "Looking up: jo***@example.com"
```

### Phone Number Masking for Logs

```javascript
/**
 * Mask phone number for logging (privacy)
 * Shows only last 4 digits
 */
function maskPhoneForLog(phone) {
  if (!phone || phone.length < 4) {
    return phone;
  }
  
  const last4 = phone.slice(-4);
  return `****${last4}`;
}

// Usage
console.log(`Looking up: ${maskPhoneForLog('+15551234567')}`);
// Output: "Looking up: ****4567"
```   const cached = this.cache.get(phone);
      if (cached && (now - cached.timestamp) < this.ttlMs) {
        if (cached.contact) {
          results.resultArray.push(cached.contact);
          results.foundArray.push(phone);
        } else {
          results.notFoundArray.push(phone);
        }
      } else {
        uncached.push(phone);
      }
    }

    // Lookup uncached numbers
    if (uncached.length > 0) {
      const freshResults = await this.batchLookup(uncached);
      
      // Update cache
      freshResults.resultArray.forEach(contact => {
        const phone = contact.phoneNumbers?.[0];
        if (phone) {
          this.cache.set(phone, { contact, timestamp: now });
        }
      });
      
      freshResults.notFoundArray.forEach(phone => {
        this.cache.set(phone, { contact: null, timestamp: now });
      });

      // Merge results
      results.resultArray.push(...freshResults.resultArray);
      results.foundArray.push(...freshResults.foundArray);
      results.notFoundArray.push(...freshResults.notFoundArray);
    }

    return results;
  }

  async batchLookup(phoneNumbers) {
    const chunkSize = 5;
    const allResults = {
      resultArray: [],
      foundArray: [],
      notFoundArray: []
    };

    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      const chunk = phoneNumbers.slice(i, i + chunkSize);
      const result = await this.webex.internal.dss.lookupByPhoneNumbers(chunk);
      
      allResults.resultArray.push(...result.resultArray);
      allResults.foundArray.push(...result.foundArray);
      allResults.notFoundArray.push(...result.notFoundArray);
    }

    return allResults;
  }

  clear() {
    this.cache.clear();
  }

  invalidate(phoneNumber) {
    this.cache.delete(phoneNumber);
  }
}

// Usage
const cache = new ContactCache(webex, 300000); // 5 min TTL
const result = await cache.lookup(['+15551234567', '+442012345678']);
```

### Cleanup on App Shutdown

Properly clean up resources:

```javascript
class DSSManager {
  constructor(webex) {
    this.webex = webex;
    this.registered = false;
  }

  async initialize() {
    if (this.registered) return;
    
    await this.webex.internal.device.register();
    await this.webex.internal.dss.register();
    this.registered = true;
  }

  async cleanup() {
    if (!this.registered) return;
    
    try {
      await this.webex.internal.dss.unregister();
      this.registered = false;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  async lookupPhoneNumbers(phoneNumbers) {
    if (!this.registered) {
      await this.initialize();
    }
    
    return await this.webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);
  }
}

// Usage
const manager = new DSSManager(webex);

// In app startup
await manager.initialize();

// In app shutdown
await manager.cleanup();
```

---

## Helper Utilities

### Phone Number Normalization

```javascript
/**
 * Normalize phone number for lookup
 * Keep this minimal to avoid bundle bloat
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) {
    throw new Error('Phone number cannot be empty');
  }
  
  // Remove spaces, hyphens, parentheses
  let cleaned = rawPhone.trim().replace(/[\s().-]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // Add default country code (adjust for your region)
    cleaned = '+1' + cleaned;
  }
  
  return cleaned;
}

// Usage
const normalized = normalizePhoneNumber('(555) 123-4567');
// Result: '+15551234567'
```

### Phone Number Masking for Logs

```javascript
/**
 * Mask phone number for logging (privacy)
 * Shows only last 4 digits
 */
function maskPhoneForLog(phone) {
  if (!phone || phone.length < 4) {
    return phone;
  }
  
  const last4 = phone.slice(-4);
  return `****${last4}`;
}

// Usage
console.log(`Looking up: ${maskPhoneForLog('+15551234567')}`);
// Output: "Looking up: ****4567"
```

### Batch Normalization

```javascript
/**
 * Normalize array of phone numbers and remove duplicates
 */
function normalizePhoneNumbers(phoneNumbers) {
  const normalized = phoneNumbers
    .map(phone => {
## Performance Tips

1. **Cache aggressively**: Implement TTL-based caching to reduce redundant lookups (both email and phone)
2. **Batch efficiently (phone)**: Use parallel batching for speed, sequential for rate limiting (max 5 per request)
3. **Parallel lookups (email)**: Email lookups can be done in parallel as each is independent
4. **Normalize once**: Normalize and deduplicate phone numbers/emails before lookup
5. **Handle errors gracefully**: Always provide fallback display values
6. **Monitor timeouts**: Consider increasing timeout for large batches on slow networks
7. **Limit concurrency**: Don't overwhelm backend with too many parallel requests
8. **Cleanup properly**: Always unregister DSS plugin on app shutdown
  // Remove duplicates
  return [...new Set(normalized)];
}

// Usage
const phones = normalizePhoneNumbers([
  '(555) 123-4567',
  '+1-555-123-4567', // duplicate
  '555-9999',
  'invalid'
]);
// Result: ['+15551234567', '+15559999']
```

---

## Complete Examples

### Complete Example: Call History Manager

A production-ready call history manager with caching, batching, and error handling:

```javascript
class CallHistoryManager {
  constructor(webex, options = {}) {
    this.webex = webex;
    this.contactCache = new Map();
    this.ttlMs = options.ttlMs || 300000; // 5 min default
    this.maxConcurrency = options.maxConcurrency || 3;
  }

  async initialize() {
    await this.webex.internal.device.register();
    await this.webex.internal.dss.register();
  }

  async resolveCallHistory(callRecords) {
    // Extract and normalize unique phone numbers
    const uniquePhones = this.extractUniquePhones(callRecords);

    // Lookup contacts with caching
    const contacts = await this.lookupWithCache(uniquePhones);

    // Map contacts to phone numbers
    const contactMap = new Map();
    contacts.forEach(contact => {
      const phone = contact.phoneNumbers?.[0];
      if (phone) {
        contactMap.set(phone, contact);
      }
    });

    // Enrich call records
    return callRecords.map(record => ({
      ...record,
      contact: contactMap.get(record.phoneNumber) || null,
      displayName: contactMap.get(record.phoneNumber)?.displayName || 
                   this.formatPhoneNumber(record.phoneNumber),
      resolved: contactMap.has(record.phoneNumber)
    }));
  }

  extractUniquePhones(callRecords) {
    const phones = callRecords
      .map(record => record.phoneNumber)
      .filter(phone => phone);
    return [...new Set(phones)];
  }

  async lookupWithCache(phoneNumbers) {
    const now = Date.now();
    const uncached = [];
    const cachedContacts = [];

    // Check cache
    for (const phone of phoneNumbers) {
      const cached = this.contactCache.get(phone);
      if (cached && (now - cached.timestamp) < this.ttlMs) {
        if (cached.contact) {
          cachedContacts.push(cached.contact);
        }
      } else {
        uncached.push(phone);
## Security & Privacy Checklist

- [ ] Mask phone numbers in logs (show only last 4 digits)
- [ ] Mask email addresses in logs (show only first 2 chars and domain)
- [ ] Obtain user consent for directory lookups if required by region
- [ ] Use encrypted storage if caching contact data
- [ ] Implement TTL for cached results
- [ ] Clear contact data on user logout
- [ ] Verify token has required scopes (`spark:people_read`)
- [ ] Document data flows for privacy impact assessments
- [ ] Implement audit logging for compliance tracking
- [ ] Handle PII appropriately for both email and phone number lookupsilter(p => p)
      );
      
      freshContacts.forEach(contact => {
        const phone = contact.phoneNumbers?.[0];
        if (phone) {
          this.contactCache.set(phone, { contact, timestamp: now });
        }
      });
      
      // Cache not found
      uncached.forEach(phone => {
        if (!foundSet.has(phone)) {
          this.contactCache.set(phone, { contact: null, timestamp: now });
        }
      });

      return [...cachedContacts, ...freshContacts];
    }

    return cachedContacts;
  }
### Issue: Phone contact not found but should exist
**Solution:** Check phone number format (should be E.164: +[country][number])

### Issue: Email contact not found but should exist
**Solution:** Verify email address is correct and user exists in organization directory
    const chunkSize = 5;
    const chunks = [];

    for (let i = 0; i < phoneNumbers.length; i += chunkSize) {
      chunks.push(phoneNumbers.slice(i, i + chunkSize));
    }

    // Process with concurrency limit
    const allContacts = [];
    for (let i = 0; i < chunks.length; i += this.maxConcurrency) {
      const batch = chunks.slice(i, i + this.maxConcurrency);
      
      const results = await Promise.all(
        batch.map(chunk =>
          this.webex.internal.dss.lookupByPhoneNumbers(chunk)
            .then(result => result.resultArray)
            .catch(error => {
              console.error('Chunk lookup failed:', error);
              return [];
            })
        )
      );
      
      allContacts.push(...results.flat());
    }

    return allContacts;
  }

  formatPhoneNumber(phone) {
    // Simple formatting for display
    if (phone.startsWith('+1') && phone.length === 12) {
      return `(${phone.slice(2, 5)}) ${phone.slice(5, 8)}-${phone.slice(8)}`;
    }
    return phone;
  }

  clearCache() {
    this.contactCache.clear();
  }

  async cleanup() {
    await this.webex.internal.dss.unregister();
    this.clearCache();
  }
}

// Usage
const manager = new CallHistoryManager(webex, {
  ttlMs: 300000,      // 5 min cache
  maxConcurrency: 3   // Max 3 parallel requests
});

await manager.initialize();

const callHistory = [
  { id: 1, phoneNumber: '+15551234567', duration: 120, timestamp: Date.now() },
  { id: 2, phoneNumber: '+442012345678', duration: 300, timestamp: Date.now() },
  { id: 3, phoneNumber: '+15551234567', duration: 60, timestamp: Date.now() }
];

const enrichedHistory = await manager.resolveCallHistory(callHistory);
console.log('Enriched call history:', enrichedHistory);

// Later...
await manager.cleanup();
```

---

## Performance Tips

1. **Cache aggressively**: Implement TTL-based caching to reduce redundant lookups
2. **Batch efficiently**: Use parallel batching for speed, sequential for rate limiting
3. **Normalize once**: Normalize and deduplicate phone numbers before batching
4. **Handle errors gracefully**: Always provide fallback display values
5. **Monitor timeouts**: Consider increasing timeout for large batches on slow networks
6. **Limit concurrency**: Don't overwhelm backend with too many parallel requests
7. **Cleanup properly**: Always unregister DSS plugin on app shutdown

---

## Security & Privacy Checklist

- [ ] Mask phone numbers in logs (show only last 4 digits)
- [ ] Obtain user consent for directory lookups if required by region
- [ ] Use encrypted storage if caching contact data
- [ ] Implement TTL for cached results
- [ ] Clear contact data on user logout
- [ ] Verify token has required scopes (`spark:people_read`)
- [ ] Document data flows for privacy impact assessments
- [ ] Implement audit logging for compliance tracking

---

## Troubleshooting

### Issue: "SDK cannot authorize"
**Solution:** Ensure valid access token with `spark:people_read` scope

### Issue: DssTimeoutError
**Solution:** Increase timeout or retry with backoff
```javascript
webex.config.dss.requestTimeout = 30000; // 30 seconds
```

### Issue: "maximum of 5 phone numbers"
**Solution:** Implement client-side batching (see examples above)

### Issue: Mercury not receiving events
**Solution:** Ensure DSS plugin is registered
```javascript
await webex.internal.dss.register();
```

### Issue: Contact not found but should exist
**Solution:** Check phone number format (should be E.164: +[country][number])

---

**Document Version:** 1.0  
**Last Updated:** December 2025  
**Maintainers:** Webex JS SDK Team
