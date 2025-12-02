#!/usr/bin/env node
/**
 * Manual Test Script for Phone Number Lookup
 * 
 * This script allows you to test the lookupByPhoneNumbers method with real credentials
 * and see actual Mercury responses.
 * 
 * Usage:
 *   WEBEX_ACCESS_TOKEN=your_token node test/manual-phone-lookup-test.js +15551234567 +15559876543
 * 
 * Or set token in the script and run:
 *   node test/manual-phone-lookup-test.js +15551234567 +15559876543
 */

const WebexCore = require('@webex/webex-core').default;
require('@webex/internal-plugin-dss');

// Configuration
const ACCESS_TOKEN = process.env.WEBEX_ACCESS_TOKEN || 'YOUR_TOKEN_HERE';
const PHONE_NUMBERS = process.argv.slice(2); // Get phone numbers from command line args

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testPhoneLookup() {
  log('\n=== Phone Number Lookup Test ===\n', colors.bright);

  // Validate configuration
  if (ACCESS_TOKEN === 'YOUR_TOKEN_HERE') {
    log('❌ ERROR: Please provide a valid access token', colors.red);
    log('Set WEBEX_ACCESS_TOKEN environment variable or update the script\n', colors.yellow);
    process.exit(1);
  }

  if (PHONE_NUMBERS.length === 0) {
    log('❌ ERROR: No phone numbers provided', colors.red);
    log('Usage: node test/manual-phone-lookup-test.js +15551234567 +15559876543\n', colors.yellow);
    process.exit(1);
  }

  log(`Phone numbers to lookup: ${PHONE_NUMBERS.join(', ')}`, colors.blue);

  // Initialize Webex SDK
  log('\n📡 Initializing Webex SDK...', colors.blue);
  const webex = new WebexCore({
    credentials: {
      access_token: ACCESS_TOKEN,
    },
  });

  try {
    // Register DSS plugin
    log('🔌 Registering DSS plugin...', colors.blue);
    await webex.internal.dss.register();
    log('✅ DSS plugin registered\n', colors.green);

    // Batch into groups of 5 if needed
    const batches = [];
    for (let i = 0; i < PHONE_NUMBERS.length; i += 5) {
      batches.push(PHONE_NUMBERS.slice(i, i + 5));
    }

    log(`📊 Processing ${batches.length} batch(es)...\n`, colors.blue);

    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      log(`\n--- Batch ${i + 1}/${batches.length} (${batch.length} numbers) ---`, colors.bright);
      log(`Numbers: ${batch.join(', ')}`, colors.blue);

      const startTime = Date.now();

      try {
        const result = await webex.internal.dss.lookupByPhoneNumbers({
          phoneNumbers: batch,
        });

        const duration = Date.now() - startTime;
        log(`\n⏱️  Response time: ${duration}ms`, colors.yellow);

        // Display results
        log('\n📋 Results:', colors.bright);
        log(`  Total entities found: ${result.resultArray.length}`, colors.green);
        log(`  Phone numbers found: ${result.foundArray?.length || 0}`, colors.green);
        log(`  Phone numbers not found: ${result.notFoundArray?.length || 0}`, colors.yellow);

        // Display found entities
        if (result.foundArray && result.foundArray.length > 0) {
          log('\n✅ Found:', colors.green);
          result.foundArray.forEach((phone) => {
            log(`  - ${phone}`, colors.green);
          });
        }

        // Display not found
        if (result.notFoundArray && result.notFoundArray.length > 0) {
          log('\n❌ Not Found:', colors.red);
          result.notFoundArray.forEach((phone) => {
            log(`  - ${phone}`, colors.red);
          });
        }

        // Display entity details
        if (result.resultArray && result.resultArray.length > 0) {
          log('\n👥 Entity Details:', colors.bright);
          result.resultArray.forEach((entity, idx) => {
            log(`\n  Entity ${idx + 1}:`, colors.blue);
            log(`    ID: ${entity.id || 'N/A'}`);
            log(`    Display Name: ${entity.displayName || 'N/A'}`);
            
            // Handle emails (can be array of strings or objects)
            if (entity.emails && Array.isArray(entity.emails)) {
              const emailList = entity.emails.map(e => typeof e === 'string' ? e : e.value || JSON.stringify(e)).join(', ');
              log(`    Emails: ${emailList}`);
            } else {
              log(`    Emails: N/A`);
            }
            
            // Handle phone numbers (can be array of strings or objects)
            if (entity.phoneNumbers && Array.isArray(entity.phoneNumbers)) {
              const phoneList = entity.phoneNumbers.map(p => typeof p === 'string' ? p : p.value || JSON.stringify(p)).join(', ');
              log(`    Phone Numbers: ${phoneList}`);
            } else {
              log(`    Phone Numbers: N/A`);
            }
            
            log(`    Type: ${entity.type || 'N/A'}`);
          });
        }

        // Display raw response (optional, can be verbose)
        if (process.env.DEBUG) {
          log('\n🔍 Raw Response:', colors.bright);
          console.log(JSON.stringify(result, null, 2));
        }

      } catch (error) {
        log(`\n❌ Batch ${i + 1} failed: ${error.message}`, colors.red);
        if (error.stack) {
          log(`\nStack trace:\n${error.stack}`, colors.red);
        }
      }
    }

    // Cleanup
    log('\n🧹 Cleaning up...', colors.blue);
    await webex.internal.dss.unregister();
    log('✅ DSS plugin unregistered', colors.green);

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  }

  log('\n✅ Test completed successfully!\n', colors.green);
}

// Run the test
testPhoneLookup().catch((error) => {
  log(`\n❌ Unhandled error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
