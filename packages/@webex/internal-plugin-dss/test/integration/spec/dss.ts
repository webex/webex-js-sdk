/*!
 * Copyright (c) 2015-2022 Cisco Systems, Inc. See LICENSE file.
 */
import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import {skipInNode} from '@webex/test-helper-mocha';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-dss', function () {
  this.timeout(60000);

  describe('DSS Integration Tests', () => {
    let webex;
    let phoneNumbers: string[];

    before(async () => {
      // Create a test user with proper authorization
      const users = await testUsers.create({count: 1});
      const testUser = users[0];
      
      // Create WebexCore instance
      // @ts-ignore - WebexCore constructor exists but TS definitions are incomplete
      webex = new WebexCore({
        credentials: {
          authorization: testUser.token,
        },
      });

      // Register DSS plugin
      await webex.internal.device.register();
      await webex.internal.dss.register();
    });

    after(async () => {
      if (webex && webex.internal.dss.registered) {
        await webex.internal.dss.unregister();
      }
    });

    describe('#lookupByPhoneNumbers', () => {
      // Skip in Node if Mercury is not available
      skipInNode(it)('should lookup phone numbers and get real Mercury responses', async () => {
        // Use your organization's actual phone numbers for testing
        // These should be numbers that exist in your directory
        phoneNumbers = [
          '+15551234567', // Replace with actual numbers from your org
        ];

        const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);

        // Assertions
        assert.isDefined(result);
        assert.isArray(result.resultArray);
        assert.isArray(result.foundArray);
        assert.isArray(result.notFoundArray);

        // Verify we got results for the phone numbers we queried
        const totalResults = result.foundArray.length + result.notFoundArray.length;
        assert.equal(totalResults, phoneNumbers.length, 'Should account for all phone numbers');
      });

      skipInNode(it)('should handle multiple phone numbers', async () => {
        phoneNumbers = [
          '+15551234567', // Replace with actual numbers
          '+15559876543',
        ];

        const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);

        assert.isDefined(result);
        assert.isArray(result.resultArray);
        assert.isArray(result.foundArray);
        assert.isArray(result.notFoundArray);
        
        // Verify all phone numbers are accounted for
        const totalResults = result.foundArray.length + result.notFoundArray.length;
        assert.equal(totalResults, phoneNumbers.length, 'Should account for all phone numbers');
      });

      skipInNode(it)('should handle unknown phone numbers gracefully', async () => {
        phoneNumbers = [
          '+19999999999', // Unknown phone number not in directory
        ];

        const result = await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);

        assert.isDefined(result);
        assert.deepEqual(result.resultArray, [], 'Should find no entities');
        assert.deepEqual(result.foundArray, [], 'Should have no found numbers');
        assert.deepEqual(result.notFoundArray, phoneNumbers, 'Should mark as not found');
      });

      it('should reject when more than 5 phone numbers provided', async () => {
        phoneNumbers = [
          '+15551111111',
          '+15552222222',
          '+15553333333',
          '+15554444444',
          '+15555555555',
          '+15556666666',
        ];

        try {
          await webex.internal.dss.lookupByPhoneNumbers(phoneNumbers);
          assert.fail('Should have thrown an error');
        } catch (error) {
          assert.include(
            error.message,
            'maximum of 5 phone numbers',
            'Should mention the limit'
          );
        }
      });
    });
  });
});
