# @webex/media-helpers

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Media helpers

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [@webex/media-helpers](#webexmedia-helpers)
  - [Install](#install)
  - [Usage](#usage)
  - [Maintainers](#maintainers)
  - [Contribute](#contribute)
  - [License](#license)

## Install

```bash
npm install --save @webex/media-helpers
```

## Usage

### Effects
There are two effects included in this package:

Virtual background (e.g., blur, image replacement, video replacement)
Noise reduction (e.g., background noise removal)

#### Virtual background
The virtual background effect provides a virtual background for video calling. The virtual background may be an image, an mp4 video, or the user's background with blur applied.

**Applying the effect**
1. Create a new camera stream instance by using createCameraStream() method.
2. Create a VirtualBackgroundEffect instance by passing appropriate constraints.
3. Use addEffect() method on cameraStream to apply effect on it.
4. Enable the effect after adding it to cameraStream using enable() method available on effect. Effect will be enabled on cameraStream.

```javascript
import {createCameraStream, VirtualBackgroundEffect} from '@webex/media-helpers';

// Create a new video stream.
const cameraStream = createCameraStream(optionalVideoConstraints);

// Create the effect.
const effect = new VirtualBackgroundEffect({
  authToken: '<encoded-string>',
  mode: `BLUR`,
  blurStrength: `STRONG`,
  quality: `LOW`,
});

// add the effect on the input camera stream.
await cameraStream.addEffect(effect);

//enable the effect once it is added to the stream
await effect.enable()
```

#### Noise reduction
The noise reduction effect removes background noise from an audio stream to provide clear audio for calling.

**Applying the effect**
1. Create a new microphone stream instance by using createMicrophoneStream() method.
2. Create a NoiseReductionEffect instance by passing appropriate constraints.
3. Use addEffect() method on microphoneStream to apply effect on it.
4. Enable the effect after adding it to microphoneStream using enable() method available on effect. Effect will be enabled on microphoneStream.

```javascript
import {createMicrophoneStream, NoiseReductionEffect} from '@webex/media-helpers';

// Create a new audio stream.
const microphoneStream = createMicrophoneStream(optionalAudioConstraints);

// Create the effect.
const effect = new NoiseReductionEffect({
  authToken: '<encoded-string>',
  mode: 'WORKLET', // or 'LEGACY'
});

// add the effect on microphone stream.
await microphoneStream.addEffect(effect);

//enable the effect once it is added to the track
await effect.enable()
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
