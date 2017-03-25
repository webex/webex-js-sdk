# ciscospark

> The Cisco Spark JavaScript SDK

## Table of Contents

- [Install](#install)
- [Usage](#usage)
  - [In Browser](#in-browser)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Install

```bash
npm install --save ciscospark
```

## Usage

See [the docs site](https://ciscospark.github.io/spark-js-sdk/) for more examples.

```javascript
const assert = require(`assert`);
assert(process.env.CISCOSPARK_ACCESS_TOKEN, 'This example assumes you have set your access token as an environment variable');
const ciscospark = require(`ciscospark`);
ciscospark.rooms.create({title: `My First Room`})
  .then((room) => {
    return Promise.all([
      ciscospark.memberships.create({
        roomId: room.id,
        personEmail: `alice@example.com`
      }),
      ciscospark.memberships.create({
        roomId: room.id,
        personEmail: `bob@example.com`
      }),
    ])
      .then(() => ciscospark.messages.create({
        markdown: `**Hi Everyone**`,
        roomId: room.id
      }));
  });
```

### In Browser

We do not provide a prebuilt version of `ciscospark`.

If you've already got a commonjs or es6 build process in place, you can simply use `const ciscospark = require('ciscospark')`.

If you need to load `ciscospark` via a script tag, you'll need to build it:

```bash
npm install ciscospark
npm install -g browserify
echo "window.ciscospark = require(`ciscospark`)" > ./index.js
browserify index.js > bundle.js
```

> In either case above, you **must** set the following environment variables
- CISCOSPARK_CLIENT_ID
- CISCOSPARK_CLIENT_SECRET
- CISCOSPARK_SCOPE
- CISCOSPARK_REDIRECT_URI

In browser usage is pretty much the same as node usage, with the addition of handling the login flow for you. See the [docs site](https://ciscospark.github.io/spark-js-sdk/example/browsers/) for more details.

## API

Full API docs are published at the [docs site](https://ciscospark.github.io/spark-js-sdk/api/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for more details.

## License

&copy; 2016-2017 Cisco and/or its affiliates. All Rights Reserved.
