### Table of Contents
- [Getting Started](#getting-started)
- [Developing](#developing)
- [Building](#building) 
- [Testing](#testing)
- [Samples](#samples) 
- [Consuming SDK](#consuming-sdk)
  - [NPM](#npm)
  - [CDN](#cdn)
---

## Getting Started
With the BYoDS SDK, you can easily integrate device management capabilities into your Webex applications, allowing users to bring their own devices seamlessly into the Webex ecosystem.

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
 yarn workspace @webex/byods run test
```

## Samples 
```bash
  yarn workspace @webex/byods-demo-server dev:hot
```

## Consuming SDK
To consume the latest stable version of the BYoDS SDK, you can use either NPM or CDN.
# NPM
```javascript
  npm install @webex/byods
```
(or)

```javascript
  yarn add @webex/byods
```

```javascript
  import BYoDS from '@webex/byods';
```
# CDN
```javascript
  <script src="../byods.min.js"></script>
```