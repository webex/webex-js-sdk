### Bring Your Own Data Source (BYoDS) Node.JS SDK

### Table of Contents

- [Getting Started](#getting-started)
- [Developing](#developing)
- [Building](#building)
- [Testing](#testing)
- [Samples](#samples)
- [Consuming SDK](#consuming-sdk)
  - [NPM](#npm)

---

## Getting Started

The BYoDS Node.js SDK makes it easy for developers to register their data sources to the BYoDS system. It allows developers to build data sources without needing to manage the complexities of integration. With features like customizable storage, service app token management, and auto refresh of JWS tokens. The BYoDS SDK provides a solid foundation for creating secure and reliable data sources.

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
yarn workspace @webex/byods run build:src
```

## Testing

```bash
 yarn workspace @webex/byods run test:unit
```

## Samples

```bash
  yarn workspace @webex/byods-demo-server dev:hot
```

## Consuming SDK

To consume the latest stable version of the BYoDS SDK, you can use NPM.

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

Test marker (byods-only): CD matrix check — ensures `yarn package-tools list --since …` includes `@webex/byods` when only this package changes.

Fork smoke (no functional change): touch BYoDS so Deploy CD publishes `@webex/byods` and the PR bot can show **Version** `byods@…`, **PR Link**, and **Changelog** (semver comes from the increment step, not this line).

Dummy touch (2026-04-20): triggers `package-tools list --since …` for `@webex/byods` so **Publish – NPM** fills `package_versions` and **comment-on-pr** uses the full “Your changes are now available” path (same as upstream when packages ship).
