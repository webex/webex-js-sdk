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
1. Create a new camera track instance by using LocalCameraTrack() method.
2. Create a VirtualBackgroundEffect instance by passing appropriate constraints.
3. Use addEffect() method on cameraTrack to apply effect on it.
4. Enable the effect after adding it to cameraTrack using enable() method available on effect. Effect will be enabled on cameraTrack.

```javascript
import {LocalCameraTrack, VirtualBackgroundEffect} from '@webex/media-helpers';

// Create a new video stream by a getting user's video media.
const stream = await navigator.mediaDevices.getUserMedia({ video: { width, height } });

const videoTrackFromLocalStream = stream.getVideoTracks()[0];

const cameraTrack = new LocalCameraTrack(new MediaStream([videoTrackFromLocalStream]));

// Create the effect.
const effect = new VirtualBackgroundEffect({
  authToken: '<encoded-string>',
  mode: `BLUR`,
  blurStrength: `STRONG`,
  quality: `LOW`,
});

// add the effect on the input camera track.
await cameraTrack.addEffect("background-blur", effect);

//enable the effect once it is added to the track
await effect.enable()
```

#### Noise reduction
The noise reduction effect removes background noise from an audio stream to provide clear audio for calling.

**Applying the effect**
1. Create a new microphone track instance by using LocalMicrophoneTrack() method.
2. Create a NoiseReductionEffect instance by passing appropriate constraints.
3. Use addEffect() method on microphoneTrack to apply effect on it.
4. Enable the effect after adding it to microphoneTrack using enable() method available on effect. Effect will be enabled on microphoneTrack.

```javascript
import {LocalMicrophoneTrack, NoiseReductionEffect} from '@webex/media-helpers';

// Create a new audio stream by getting a user's audio media.
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

const audioTrackFromLocalStream = stream.getAudioTracks()[0];

const microphoneTrack = new LocalMicrophoneTrack(new MediaStream([audioTrackFromLocalStream]));

// Create the effect.
const effect = new NoiseReductionEffect({
  authToken: '<encoded-string>',
  mode: 'WORKLET', // or 'LEGACY'
});

// add the effect on microphone track.
await microphoneTrack.addEffect("background-noise-removal", effect);

//enable the effect once it is added to the track
await effect.enable()
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2022 Cisco and/or its affiliates. All Rights Reserved.
