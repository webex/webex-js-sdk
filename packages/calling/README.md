### Table of Contents
- [Getting Started](#getting-started)
- [Developing](#developing)
- [Building](#building) 
- [Testing](#testing)
- [Samples](#samples) 
- [Consuming SDK](#consuming-sdk)
  - [NPM](#npm)
  - [CDN](#cdn)
- [Kitchen Sink App](#kitchen-sink-app)
---

## Getting Started
With the Webex Calling SDK, you can effortlessly integrate fundamental audio calling capabilities into your solutions, enhancing the way your users connect.

- [Introduction to the Webex Web Calling SDK](https://github.com/webex/webex-js-sdk/wiki/Introducing-the-Webex-Web-Calling-SDK)
- [Quickstart guide](https://github.com/webex/webex-js-sdk/wiki/Quickstart-Guide-(Calling)).
- API guide - TBD.
 
## Developing

```bash
git clone https://github.com/\<your-fork\>/webex-js-sdk.git
cd web-js-sdk/
yarn install
```

## Building

If your project needs some additional steps for the developer to build the
project after some code changes, state them here:

```bash
yarn workspaces foreach --parallel --verbose run build:src

yarn build:local
```

## Testing

```bash
 yarn workspace @webex/calling run test
```

## Samples 
```bash
  yarn run samples:serve
```

## Consuming SDK
To consume the latest stable version of the Calling SDK one can use NPM or CDN.
# NPM
```javascript
  npm install @webex/calling
```
(or)

```javascript
  yarn add @webex/calling
```

```javascript
  import Calling from '@webex/calling'
```
# CDN
```javascript
  <script src="../calling.min.js"></script>
```

### Kitchen Sink App
To test Calling SDK API, use this Kitchen Sink app: https://webex.github.io/webex-js-sdk/samples/calling/ 




