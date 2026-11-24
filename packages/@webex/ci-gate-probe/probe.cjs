// DISPOSABLE CI GATE PROBE. DO NOT MERGE. No SDK code or network access.
const assert = require('node:assert/strict');

const outcomes = {"unit": "fail", "integration": "pass"};
const suite = process.argv[2];
assert.ok(Object.prototype.hasOwnProperty.call(outcomes, suite), 'Unknown probe suite');
console.log(`CI_GATE_PROBE suite=${suite} outcome=${outcomes[suite]}`);
assert.equal(outcomes[suite], 'pass', `INTENTIONAL CI GATE PROBE FAILURE: ${suite}. DO NOT MERGE.`);
