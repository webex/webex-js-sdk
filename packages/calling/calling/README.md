# web-calling-sdk

> A framework for interacting with Web Calling API across multiple browsers.

> API guide https://sqbu-github.cisco.com/pages/webrtc-calling/mobius/mobius-api-spec/docs/
> Registration flow details https://wiki.cisco.com/display/IPCBU/Registration+Flows
> Calling SDK API https://wiki.cisco.com/display/IPCBU/Calling+SDK+API
 
## Developing

```shell
git clone https://github.com/webex/webex-js-sdk.git
cd web-js-sdk/
yarn i
```

### Building

If your project needs some additional steps for the developer to build the
project after some code changes, state them here:

```shell
yarn workspaces foreach --parallel --verbose run build:src

 yarn workspace @webex/calling run build
```

### Testing

```shell
 yarn workspace @webex/calling run test
```


### Testing on samples // This will change in future for now 

```
 yarn workspace @webex/calling run build:browser
 yarn run samples:serve
```


### Deploying / Publishing

In case there's some step you have to take that publishes this project to a
server, this is the right time to state it.

```shell
yarn release
```

### Consuming the SDK

The Calling SDK package can be incorporated into an existing project by updating the .npmrc and package.json. Add the line pasted below to get access to the calling-sdk package located in the artifactory.

```shell
@webex:registry=https://engci-maven.cisco.com/artifactory/api/npm/webex-npm-group
```

Use the following commands to update the package.json and package.lock/yarn.lock with the latest version of the calling-sdk package.
```shell
npm install @webex/web-calling-sdk
```
(or)
```shell 
yarn add @webex/web-calling-sdk
```