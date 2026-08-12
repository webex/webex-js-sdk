/*!
 * Security lint rules shared by the package source and the samples.
 *
 * These are acceptance criteria (spec AC5), not style preferences, so every rule
 * is an error and none of them may be downgraded or disabled inline.
 */

const DOM_SINK_MESSAGE =
  'HTML sinks are banned. Render untrusted values with textContent and createElement.';

const securityRules = {
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-restricted-properties': [
    'error',
    {property: 'innerHTML', message: DOM_SINK_MESSAGE},
    {property: 'outerHTML', message: DOM_SINK_MESSAGE},
    {property: 'insertAdjacentHTML', message: DOM_SINK_MESSAGE},
    {object: 'document', property: 'write', message: DOM_SINK_MESSAGE},
    {object: 'document', property: 'writeln', message: DOM_SINK_MESSAGE},
  ],
  'no-restricted-syntax': [
    'error',
    {
      selector: 'CallExpression[callee.property.name="postMessage"] > Literal.arguments[value="*"]',
      message:
        "postMessage must be called with an exact target origin. '*' broadcasts to any document.",
    },
    {
      selector: 'CallExpression[callee.name="postMessage"] > Literal.arguments[value="*"]',
      message:
        "postMessage must be called with an exact target origin. '*' broadcasts to any document.",
    },
    {
      selector: 'Property[key.value="allowedOrigins"] ArrayExpression > Literal[value="*"]',
      message: "'*' is not a valid allowed origin. List exact origins.",
    },
    {
      selector: 'ForInStatement',
      message:
        'for..in walks the prototype chain. Use Object.keys/values/entries on a checked object.',
    },
  ],
};

module.exports = securityRules;
