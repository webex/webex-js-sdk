# @webex/common

Utility functions and helpers for the Cisco Webex JS SDK.

## Install

```bash
npm install --save @webex/common
```

## What it Does

This package provides essential utility functions used throughout the Webex SDK. While many exports are designed for internal SDK use, several utilities can be useful in general applications.

## Usage

### Capped Debounce

A debounce function that executes after a time delay OR after a maximum number of calls.

```js
import {cappedDebounce} from '@webex/common';

const debouncedFn = cappedDebounce(
  () => console.log('Executed!'),
  1000, // Wait 1 second
  {
    maxWait: 5000,  // Execute after 5 seconds maximum
    maxCalls: 10    // Execute after 10 calls maximum
  }
);

// Will execute after 1 second of inactivity, 10 calls, or 5 seconds total
debouncedFn();
```

### Defer

Creates a deferred promise with exposed resolve/reject methods.

```js
import {Defer} from '@webex/common';

const deferred = new Defer();

// Resolve later
setTimeout(() => {
  deferred.resolve('Success!');
}, 1000);

deferred.promise.then(result => {
  console.log(result); // 'Success!'
});
```

### One Flight

Decorator that ensures a method only runs one instance at a time, preventing duplicate calls.

```js
import {oneFlight} from '@webex/common';

class MyClass {
  @oneFlight
  async fetchData() {
    // This will only run one instance at a time
    // Subsequent calls while running will return the same promise
    return await fetch('/api/data');
  }
}
```

### Exception

Utility for creating custom error types.

```js
import {Exception} from '@webex/common';

const MyError = Exception.extend('MyError');
throw new MyError('Something went wrong');
```

### Tap

Utility for debugging promise chains without affecting the flow.

```js
import {tap} from '@webex/common';

fetch('/api/data')
  .then(tap(response => console.log('Response received:', response)))
  .then(response => response.json())
  .then(tap(data => console.log('Data parsed:', data)));
```

### Deprecated

Decorator for marking methods as deprecated.

```js
import {deprecated} from '@webex/common';

class MyClass {
  @deprecated('Use newMethod() instead')
  oldMethod() {
    // Will log deprecation warning when called
  }
}
```

## Available Utilities

- **cappedDebounce** - Debounce with call count limit
- **defer** - Deferred promise creation
- **deprecated** - Deprecation warnings
- **exception** - Custom error types
- **oneFlight** - Prevent duplicate method calls
- **tap** - Debug promise chains

## SDK Integration

These utilities are primarily designed for use within the Webex SDK ecosystem but can be useful in any JavaScript application requiring these common patterns.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
