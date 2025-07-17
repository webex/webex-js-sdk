# @webex/storage-adapter-spec

Test suite for storage adapter implementations in the Webex SDK.

## Install

```bash
npm install --save-dev @webex/storage-adapter-spec
```

## Usage

This package provides a standard test suite to verify storage adapter implementations.

```js
import runAbstractStorageAdapterSpec from '@webex/storage-adapter-spec';
import MyStorageAdapter from './my-storage-adapter';

describe('MyStorageAdapter', () => {
  runAbstractStorageAdapterSpec(new MyStorageAdapter('test'));
});
```

## What it Tests

The test suite verifies that your storage adapter correctly implements:

- Data storage and retrieval
- Key-value operations (put, get, del)
- Namespace isolation
- Error handling for missing keys
- Clear functionality

## Creating Custom Adapters

Your storage adapter should implement:

- `bind(namespace, options)` - Return a bound storage interface
- Bound interface methods: `put(key, value)`, `get(key)`, `del(key)`, `clear()`

The test suite will validate these operations work correctly and handle edge cases properly.

## Usage in Testing

Include this spec in your adapter's test suite to ensure compatibility with the Webex SDK storage system.
