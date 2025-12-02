# Integration Testing Guide for Phone Number Lookup

This guide explains how to test the `lookupByPhoneNumbers` method with actual Webex credentials and real Mercury responses.

## Prerequisites

1. **Webex Access Token**: You need a valid Webex access token with directory search permissions
2. **Phone Numbers**: Phone numbers that exist in your Webex organization's directory

## Getting a Webex Access Token

### Option 1: Developer Portal (Quick Test)
1. Go to https://developer.webex.com/docs/api/getting-started
2. Log in with your Webex account
3. Copy your personal access token (valid for 12 hours)

### Option 2: OAuth Integration (Production)
1. Create an OAuth integration at https://developer.webex.com/my-apps
2. Request the following scopes:
   - `spark:people_read` (required for directory lookups)
3. Complete the OAuth flow to get an access token

## Testing Methods

### Method 1: Manual Test Script (Recommended for Quick Testing)

The manual test script provides detailed output and is great for interactive testing.

#### Setup
```bash
cd packages/@webex/internal-plugin-dss
chmod +x test/manual-phone-lookup-test.js
```

#### Usage

**With environment variable:**
```bash
WEBEX_ACCESS_TOKEN=your_token_here node test/manual-phone-lookup-test.js +15551234567 +15559876543
```

**Or edit the script and set token directly:**
```javascript
const ACCESS_TOKEN = 'your_token_here';
```

Then run:
```bash
node test/manual-phone-lookup-test.js +15551234567 +15559876543
```

#### Enable Debug Mode
To see raw Mercury responses:
```bash
DEBUG=true WEBEX_ACCESS_TOKEN=your_token node test/manual-phone-lookup-test.js +15551234567
```

#### Example Output
```
=== Phone Number Lookup Test ===

Phone numbers to lookup: +15551234567, +15559876543

📡 Initializing Webex SDK...
🔌 Registering DSS plugin...
✅ DSS plugin registered

📊 Processing 1 batch(es)...

--- Batch 1/1 (2 numbers) ---
Numbers: +15551234567, +15559876543

⏱️  Response time: 342ms

📋 Results:
  Total entities found: 1
  Phone numbers found: 1
  Phone numbers not found: 1

✅ Found:
  - +15551234567

❌ Not Found:
  - +15559876543

👥 Entity Details:

  Entity 1:
    ID: Y2lzY29zcGFyazovL3VzL1BFT1BMRS8xMjM0NTY=
    Display Name: John Doe
    Emails: john.doe@example.com
    Phone Numbers: +15551234567, +15551234568
    Type: PERSON

✅ Test completed successfully!
```

### Method 2: Integration Tests (Automated Testing)

Integration tests run with the full test suite and are better for CI/CD.

#### Setup
```bash
cd packages/@webex/internal-plugin-dss
```

#### Update Test Phone Numbers
Edit `test/integration/spec/dss.ts` and replace placeholder numbers:
```typescript
phoneNumbers = [
  '+15551234567', // Replace with actual numbers from your org
];
```

#### Run Tests

**Run all integration tests:**
```bash
npm run test:integration
```

**Run only DSS integration tests:**
```bash
npm run test:integration -- --grep "lookupByPhoneNumbers"
```

**With authentication:**
```bash
WEBEX_ACCESS_TOKEN=your_token npm run test:integration
```

### Method 3: Browser Console Testing

For testing in a browser environment with Mercury websocket:

1. Open your Webex web app or a page with the SDK loaded
2. Open browser DevTools console
3. Run:

```javascript
// Ensure DSS is registered
await webex.internal.dss.register();

// Test lookup
const result = await webex.internal.dss.lookupByPhoneNumbers({
  phoneNumbers: ['+15551234567', '+15559876543']
});

console.log('Results:', result);
console.log('Found:', result.foundArray);
console.log('Not found:', result.notFoundArray);
console.log('Entities:', result.resultArray);

// Cleanup
await webex.internal.dss.unregister();
```

## Testing Scenarios

### Scenario 1: Single Phone Number (Known)
Test with a phone number that exists in your directory:
```bash
node test/manual-phone-lookup-test.js +15551234567
```

**Expected:** Entity found with contact details

### Scenario 2: Multiple Phone Numbers (Mixed)
Test with a mix of known and unknown numbers:
```bash
node test/manual-phone-lookup-test.js +15551234567 +19999999999
```

**Expected:** 
- `foundArray`: ['+15551234567']
- `notFoundArray`: ['+19999999999']
- `resultArray`: [entity for +15551234567]

### Scenario 3: Exactly 5 Numbers (Boundary Test)
```bash
node test/manual-phone-lookup-test.js +1555111 +1555222 +1555333 +1555444 +1555555
```

**Expected:** Single request, all processed together

### Scenario 4: More Than 5 Numbers (Batching)
```bash
node test/manual-phone-lookup-test.js +1555111 +1555222 +1555333 +1555444 +1555555 +1555666 +1555777
```

**Expected:** Script automatically batches into 2 requests (5 + 2)

### Scenario 5: Unknown Numbers
```bash
node test/manual-phone-lookup-test.js +19999999999
```

**Expected:** Empty `resultArray`, number in `notFoundArray`

### Scenario 6: Timeout Testing
To test timeout behavior, you can modify the config temporarily:
```javascript
webex.config.dss.requestTimeout = 1000; // 1 second
```

## Observing Mercury Events

To see actual Mercury websocket traffic:

### In Browser DevTools
1. Open Network tab
2. Filter by "WS" (WebSocket)
3. Find the Mercury connection
4. Click to see frames
5. Look for `event:directory.lookup` messages

### In Node.js
Add Mercury event listeners:
```javascript
webex.internal.mercury.on('event:directory.lookup', (envelope) => {
  console.log('Mercury Event:', JSON.stringify(envelope, null, 2));
});
```

## Troubleshooting

### Error: "SDK cannot authorize"
- Verify your access token is valid
- Check token hasn't expired (developer tokens expire in 12 hours)
- Ensure token has `spark:people_read` scope

### Error: "DSS did not respond within timeout"
- Check network connectivity
- Verify Mercury connection is established
- Try increasing timeout: `webex.config.dss.requestTimeout = 30000`

### No Results Found
- Verify phone numbers are in E.164 format (+country_code + number)
- Check numbers exist in your organization's directory
- Try with your own phone number from your Webex profile

### Mercury Connection Issues
- Ensure you're not behind a firewall blocking websockets
- Check proxy settings if in corporate network
- Try in browser first to verify connectivity

## Phone Number Format

Always use E.164 format:
- ✅ `+15551234567` (correct)
- ❌ `555-123-4567` (wrong)
- ❌ `(555) 123-4567` (wrong)
- ❌ `15551234567` (missing +)

## Security Notes

⚠️ **Important Security Reminders:**

1. **Never commit access tokens** to version control
2. **Use environment variables** for tokens in scripts
3. **Rotate tokens regularly** in production
4. **Use OAuth** for production applications, not developer tokens
5. **Mask phone numbers** in logs (show last 4 digits only)

## Example Test Session

```bash
# Set token once
export WEBEX_ACCESS_TOKEN="your_token_here"

# Test various scenarios
node test/manual-phone-lookup-test.js +15551234567
node test/manual-phone-lookup-test.js +15551234567 +15559876543
node test/manual-phone-lookup-test.js +19999999999

# With debug output
DEBUG=true node test/manual-phone-lookup-test.js +15551234567

# Cleanup
unset WEBEX_ACCESS_TOKEN
```

## CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run Integration Tests
  env:
    WEBEX_ACCESS_TOKEN: ${{ secrets.WEBEX_ACCESS_TOKEN }}
    TEST_PHONE_NUMBERS: ${{ secrets.TEST_PHONE_NUMBERS }}
  run: npm run test:integration
```

Store test phone numbers as secrets to avoid exposing real user data.

## Additional Resources

- [Webex Developer Portal](https://developer.webex.com)
- [Directory Search API Docs](https://developer.webex.com/docs/api/v1/people)
- [OAuth Guide](https://developer.webex.com/docs/integrations)
- [SDK Documentation](../../README.md)
