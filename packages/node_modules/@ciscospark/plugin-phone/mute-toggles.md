# Mute Toggles

When muting audio or video, there are different workflows depending on the status of the call at the time.

The following are the current workflows:

* Muting Audio
  * Call starts with audio
    * Changing from send to mute
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
    * Changing from mute to send
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
  * Call starts without audio
    * Changing from mute to send
      * SDP renegotiation needed
      * PUT on /media with id and SDP after renegotiation
    * Changing back from send to mute
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
* Muting Video
  * Call starts with Video
    * Changing from send to mute
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
    * Changing from mute to send
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
  * Call starts without Video
    * Changing from mute to send
      * SDP renegotiation needed
      * PUT on /media with id and SDP after renegotiation
    * Changing back from send to mute
      * No SDP renegotiation needed
      * PUT on /media with id and mute flags
        * No SDP sent
