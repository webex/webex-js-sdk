# @webex/test-users

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> The Webex Test Users library allows developers to create test users for integration testing.

- [@webex/test-users](#webextest-users)
  - [Install](#install)
  - [Usage](#usage)
  - [Implementation](#implementation)
    - [Whistler](#whistler)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/test-users
```

## Usage

_Note: This package is NODE only, not for browser usage_

With the test users library, you can create and remove Webex test users:

```javascript
import {createTestUser, removeTestUser} from '@webex/test-users';

createTestUser({displayName: 'Test User'}).then((myTestUser) => {
  // Do something amazing with myTestUser

  // When done, remove the test user
  removeTestUser(myTestUser);
});
```

The test users library falls back to a few environment variables if they aren't passed as config options:

- `WEBEX_CLIENT_ID` - The Webex client ID that has access to create test users
- `WEBEX_CLIENT_SECRET` - The Webex client secret for the given client id
- `WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL` - The Webex url for conversation service to create test users
- `WEBEX_SCOPE` - The Webex scope the test users should be created with
- `IDBROKER_BASE_URL` - The Webex auth endpoint to get a client based access token
- [DEPRECATED] `WEBEX_TEST_USERS_CONVERSATION_SERVICE_URL` - use `WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL` instead

## Implementation

Test User creation follows a different flow than standard users due to the fact that they are created on the fly.

The creation steps are as follows:

- A client access token is generated from the client id and secret.
  - Uses the "idbroker" url defined in `IDBROKER_BASE_URL` or passed via options
- A test user is generated with the client access token
  - Uses the url defined in `WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL` or passed via options

### Whistler

To use tests users from the Whistler Service, pass `whistler: true` to the `createTestUsers` options
You will also need to `removeTestUser` once you're done using them

```javascript
import {createTestUser, removeTestUser} from '@webex/test-users';

createTestUser({whistler: true}).then((myTestUser) => {
  // Do something amazing with myTestUser

  // When done, remove the test user
  removeTestUser(myTestUser);
});
```

Whistler requires additional environment variables and scopes to generate test users:

- `WHISTLER_MACHINE_ACCOUNT` - The Machine Account that can generate and authorize requests to the Whistler Service
- `WHISTLER_MACHINE_PASSWORD` - The password for the given Machine Account
- `WHISTLER_TEST_ORG_ID` - The Test Org ID that has the ability to get test users from the Whistler Service
- `WHISTLER_API_SERVICE_URL` - The Webex url for the Whistler Service to get test users

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
