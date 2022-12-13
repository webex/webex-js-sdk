# @webex/internal-plugin-voicea

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for the Voicea service

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [@webex/internal-plugin-voicea](#webexinternal-plugin-voicea)
  - [Install](#install)
  - [Usage](#usage)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-voicea
```

## Usage

```js

import '@webex/internal-plugin-voicea';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
// locusUrl is got from meeting.locusInfo.url;
// datachannelUrl is got from meeting.locusInfo.info.datachannelUrl; 
// internally uses LLM plugin
webex.internal.voicea.registerAndConnect(locusUrl, datachannelUrl);

```
Toggle Transcribing

* Enable/Disable Transcribing in a meeting
* Automatically activates Closed Captions(CC) if enabled.  
```js
await webex.internal.voicea.toggleTranscribing(true);
await webex.internal.voicea.toggleTranscribing(false);
```


Toggle Captions

* Enable Captioning in a meeting
* Closed Caption cannot be turned off in a meeting
* Triggers voicea:captionOn
  
```js
await webex.internal.voicea.toggleTranscribing(true);
await webex.internal.voicea.toggleTranscribing(false);
```

Set Spoken Language
* Host can set the spoken language of the meeting
* Triggers voicea:spokenLanguageSet
```js
webex.internal.voicea.setSpokenLanguage('en');
```

Set Caption Language
* Anyone can request caption languages for the meeting
```js
webex.internal.voicea.requestLanguage('en');
```

Other Triggers:
* voicea:announcement - Triggered when voicea has 
joined the meeting
* voicea:captionLanguageUpdate - Triggered when a response for requesting caption language is recieved.
* voicea:newCaption - Returns a caption sent by voicea
* voicea:wxa - Triggers whenever WXA is listening or finished listening, along with any action taken
* voicea:highlightCreated - Returns the created highlight
## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
