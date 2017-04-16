# spark-js-sdk

> Monorepo containing the Cisco Spark JavaScript SDKs (both current and legacy).

[ciscospark](/packages/node_modules/ciscospark) is a collection of node modules targeting our [external APIs](https://developer.ciscospark.com). Its core libraries take inspiration from our web client's Legacy SDK.

This README primarily discusses the tooling required to develop the Cisco Spark SDK.

## Table of Contents

- [Install](#Install)
- [Usage](#Usage)
- [Contribute](#Contribute)
- [License](#License)

## Install

Install tooling dependencies with

```bash
npm install
```

## Usage

See [SCRIPTS.md](SCRIPTS.md) for commands for building and testing the sdk.

### Documentation
To compile the documentation locally, make sure you have [Bundler](http://bundler.io/) or [Jekyll](https://jekyllrb.com/) installed then run the following:

**Set Up Environment (with Bundler)**
```bash
cd docs
bundle install
```

**Compile and Serve Docs**
```bash
cd docs
bundle exec jekyll serve --config=_config.yml,_config.local.yml
```

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

## License

&copy; 2016-2017 Cisco and/or its affiliates. All Rights Reserved.
