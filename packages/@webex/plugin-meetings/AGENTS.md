# Unit tests
Plugin-meetings unit tests are slow, so always run only the tests you care about.
To run a single test or a set of tests for plugin-meetings, always temporarily add `.only` in the test code, for example:
```javascript
it.only('should do something', () => {
  // test code
});
```
and always remove '.only' once you finish running the tests.
