/*!
 * Test script for modern decorators
 */

const { demonstrateModernDecorators } = require('./lib/@webex/common/src/decorators/usage-examples');

async function runTest() {
  try {
    console.log('Testing modern Webex decorators...\n');
    await demonstrateModernDecorators();
    console.log('\n✅ Modern decorator test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

runTest();
