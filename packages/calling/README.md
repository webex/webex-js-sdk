# @webex/calling

With the Webex Calling SDK, you can effortlessly integrate fundamental audio calling capabilities into your solutions, enhancing the way your users connect.

> [Introduction to the Webex Web Calling SDK](https://github.com/webex/webex-js-sdk/wiki/Introducing-the-Webex-Web-Calling-SDK)
> [Quickstart guide](https://github.com/webex/webex-js-sdk/wiki/Quickstart-Guide-(Calling))

 
## Developing

```shell
git clone https://github.com/\<your-fork\>/webex-js-sdk.git
cd web-js-sdk/
yarn install
```

### Building

If your project needs some additional steps for the developer to build the
project after some code changes, state them here:

```shell
yarn workspaces foreach --parallel --verbose run build:src

yarn build:local
```

### Testing

```shell
 yarn workspace @webex/calling run test
```

### Testing on samples
```shell
 yarn run samples:serve
```

### Consuming the SDK

The Calling package can be incorporated into an existing project by updating the package.json. Add the line pasted below to get access to the calling-sdk package located in the artifactory.


Use the following commands to update the package.json and package.lock/yarn.lock with the latest version of the calling-sdk package.
```shell
npm install @webex/web-calling-sdk
```
(or)
```shell 
yarn add @webex/web-calling-sdk
```
