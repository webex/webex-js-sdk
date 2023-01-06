# @webex/test-helper-test-users

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

>

- [@webex/test-helper-test-users](#webextest-helper-test-users)
  - [Install](#install)
  - [Usage](#usage)
    - [Environment Defaults](#environment-defaults)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/test-helper-test-users
```

## Usage

The `test-helper-test-users` package is a helper for [mocha](https://mochajs.org/) tests that handles the creation and deletion of test users in integration tests.

```javascript
import webex from 'webex';
import testUsers from '@webex/test-helper-test-users';

describe('My Amazing Integration Test Suite', () => {
  let testUserA, testUserB, testUserC;

  before('create users', () => {
    // Create Three Test Users
    return testUsers.create({count: 3})
  })
    .then((createdTestUsers) => {
      // Save the created test users
      [testUserA, testUserB, testUserC] = createdTestUsers;

      // Create a new sdk instance for the test user
      testUserA.webex = webex.init({
        config: {
          credentials: {
            authorization: testUserA.token
          }
        }
    });

  it('can do things with a test user', () => {
    testUserA.people.get('me')
  });
```

### Environment Defaults

The test users package defaults to certain environment variables if the values aren't specified in the "create" command. Those variables are:

- `WEBEX_CLIENT_ID` - The Webex client ID that has access to create test users
- `WEBEX_CLIENT_SECRET` - The Webex client secret for the given client id
- `WEBEX_TEST_USERS_CI_GATEWAY_SERVICE_URL` - The Webex url for conversation service to create test users
- `WEBEX_SCOPE` - The Webex scope the test users should be created with
- `IDBROKER_BASE_URL` - The Webex auth endpoint to get a client based access token

These variables can been passed in to the `create` command as a `config` object as well:

```javascript
const createConfig = {
  clientId: mySpecificValue,
  clientSecret: mySpecificValue,
  idbrokerUrl: mySpecificValue,
  cigServiceUrl: mySpecificValue,
  scope: mySpecificValue,
};

testUsers.create({config: createConfig});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.
