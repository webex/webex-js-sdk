// DISPOSABLE CI GATE PROBE. DO NOT MERGE. No SDK code or network access.
const assert = require('node:assert/strict');

const outcomes = {"unit": "pass", "integration": "wait"};
const suite = process.argv[2];
assert.ok(Object.prototype.hasOwnProperty.call(outcomes, suite), 'Unknown probe suite');
console.log(`CI_GATE_PROBE suite=${suite} outcome=${outcomes[suite]}`);
if (outcomes[suite] === 'wait') {
  console.log('CI_GATE_PROBE controlled cancellation window: 120 seconds. DO NOT MERGE.');
  setTimeout(() => {
    assert.fail('CI_GATE_PROBE cancellation window expired. DO NOT MERGE.');
  }, 120000);
} else {
  assert.equal(outcomes[suite], 'pass', `INTENTIONAL CI GATE PROBE FAILURE: ${suite}. DO NOT MERGE.`);
}
