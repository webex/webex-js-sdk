const addCommand = require('./lib/add-command');

[
  'getAttribute',
  'getCssProperty',
  'getElementSize',
  'getHTML',
  'getLocation',
  'getLocationInView',
  'getTagName',
  'getText',
  'getValue'
].forEach((getterName) => {
  const asserterName = getterName.replace('get', 'assert');
  const asserterInverseName = getterName.replace('get', 'assertNot');

  addCommand(asserterName, function assert(selector, ...args) {
    const expected = String(args.pop());
    const getter = () => this[getterName](selector, ...args);

    this.waitUntil(() => getter() === expected, 5000, `Timed-out waiting for "$(${selector})" to equal ${expected}, current value is ${getter()}`);
  });

  addCommand(asserterInverseName, function assert(selector, ...args) {
    const expected = String(args.pop());
    const getter = () => this[getterName](selector, ...args);

    this.waitUntil(() => getter() !== expected, 5000, `Timed-out waiting for "$(${selector})" to not equal ${expected}`);
  });
});

[
  'getSource',
  'getTitle',
  'getUrl'
].forEach((getterName) => {
  const asserterName = getterName.replace('get', 'assert');
  const selector = getterName.replace('get', '').toLowerCase();
  const asserterInverseName = getterName.replace('get', 'assertNot');

  addCommand(asserterName, function assert(...args) {
    const expected = args.pop();

    this.waitUntil(() => this[getterName](...args) === expected, 2000, `Timed-out waiting for "page ${selector}" to equal ${expected}; current value is "${this[getterName](...args)}"`);
  });

  addCommand(asserterInverseName, function assert(...args) {
    const expected = args.pop();

    this.waitUntil(() => this[getterName](...args) !== expected, 2000, `Timed-out waiting for "page ${selector}" to equal ${expected}; current value is "${this[getterName](...args)}"`);
  });
});
