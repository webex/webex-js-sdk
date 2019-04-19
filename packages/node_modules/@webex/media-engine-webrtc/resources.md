# Resources

> Calling is hard. Here are some resources to help understand WebRTC and how browsers handle it

## General Resources

* Chrome has a built in webrtc debug tool that can be accessed at: (chrome://webrtc-internals/)
* Firefox has a built in webrtc debug tool that can be accessed at: (about:webrtc)

## PeerConnection

* WebRTC 1.0 Best practices: https://blog.mozilla.org/webrtc/the-evolution-of-webrtc/
* How to use properly replaceTrack: https://blog.mozilla.org/webrtc/warm-up-with-replacetrack/

## Gotchas

* `offerOptions` for PeerConnections is "legacy" and will be deprecated soon. We are supposed to migrate to Tranceivers once Chrome supports them or a adapter.js shim is created: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createOffer
* `offerToReceiveX` has been broken numerous times in FF (60 supposedly fixes the issue): https://bugzilla.mozilla.org/show_bug.cgi?id=1425618
* Chrome removes remote receivers and fires `onended` when `setRemoteDescription` is called and the media connection's direction removes `recv`. Firefox does not fire `onended` nor does it remove the `receiver`
* Our signaling server does not return a `a=group:BUNDLE` line in the answer sdp. This causes Chrome to error out when calling `setRemoteDescription`. We have a patch in place to splice the line in.
