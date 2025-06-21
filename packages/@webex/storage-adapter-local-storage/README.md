# @webex/storage-adapter-local-storage

Storage adapter that uses browser localStorage for the Webex SDK.

## Install

```bash
npm install --save @webex/storage-adapter-local-storage
```

## Usage

This package provides localStorage functionality for the Webex SDK storage system.

```js
import StorageAdapterLocalStorage from '@webex/storage-adapter-local-storage';

const adapter = new StorageAdapterLocalStorage('webex-storage');

// Bind to a namespace
adapter.bind('myNamespace', { logger: console })
  .then(store => {
    // Store data
    return store.put('key', 'value');
  })
  .then(() => {
    // Retrieve data
    return store.get('key');
  })
  .then(value => {
    console.log('Retrieved:', value);
  });
```

## Methods

### Constructor

Creates a new localStorage adapter.

- `basekey` - The base key under which all data will be stored in localStorage

### bind(namespace, options)

Returns a storage interface bound to a specific namespace.

- `namespace` - Namespace for data isolation
- `options.logger` - Logger instance for debugging

### Bound Storage Methods

- `put(key, value)` - Store a value
- `get(key)` - Retrieve a value
- `del(key)` - Delete a value
- `clear()` - Clear all data for this namespace

## Browser Support

This adapter requires localStorage support and will only work in browser environments.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
