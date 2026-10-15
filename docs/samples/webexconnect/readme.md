# History

## 1.8.0.87 | 
[WXCC-13044](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-13044)

### Demo App Changes
1. Added key `includeFirebaseScripts` to app.config.js. Setting this to `true` will import Firebase related scripts.

### SDK Changes
1. Added a property to _imiconnect object ->`isFirebaseConfigAvailable`. This is being set/unset depending upon whether Firebase config is available. This additional check is required as policy.basicPush is provided as `true` even when no Firebase config is available.

## 1.8.0.086 | JWT and Retry failure issue fix
https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-11862

###  Demo App Changes
1. Replaced existing approach to handle securityToken expiry with managing expiry/reissue from IMITemplatedComponent.
2. Added `IMIEvent.onSecurityTokenRefreshCompleteEvent` to handle token updates across IMITempalateComponents
0. Added separate page security-token-test.html for testing the retry scenario
0. Added `isJWTEnabled` to Environment for specifying JWT token requirement per asset.


### SDK Changes
1. `RETRY_TIMEOUT` updated to 3 minutes.
0. SDK will now call `_invokeSecurityTokenListeners` in case of Token related issues for API calls
0. `AjaxHeaders` will now be updated with SecurityToken
0. Renamed misc internal methods.



## 1.7.1.083 | Library Version Update
### Ticket
 1. https://imimobile.atlassian.net/browse/WXCNCT-29886
### Summary
SDK has below dependencies to update:
1. Crypto.js 
0. Firebase's Cloud Messaging. 
0. Jquery.js
0. Mqttws31.js
### Changes
1. Firebase: Update existing version 11.0.1 to 11.1.0 (latest).
``` 
IMPORTANT
For push notifications, Ensure that the Operating System has notifications enabled for the Browser. This is in addition to the Push Permissions requested at JavaScript level.
```
2. No update to other libraries taken up at the moment.



## 1.7.0.082 - Supporting the LiveChat in Multitab POC
Ticket: https://imimobile.atlassian.net/browse/WXCNCT-28346

### SDK CHANGES
SDK now deduplicates calls to deliveryUpdate API when setMessagesAsRead method gets called from Multiple Tabs. The approach uses a combination of delayed broadcast to out-of-focus tabs, along with onFetchHandler at service worker. The onFetchHandler stalls subsequent requests for the same transactionID.

SDK has been modified to support In-App Messages across multiple iframes, tabs and windows within same browser. MQTT related features are moved to Service Worker (from `IMIClient.js`). The Service Worker is then responsible for broadcasting the events back to `ConnectedClients`.

- File `mqttws31.js` has been modified to support Service Worker. All future versions of the file must have below accommodations for supporting Service Worker.
    - Added stub for window object as Service Workers do not have access to 
    - Added stub for localStorage, which is not available in Service Worker.
    - Disabled check for localStorage
    - Modified the check for WebSocket support
    - Modified the check for ArrayBuffer support
    - Modified to remove window usage
- File `sw.js` is updated to handle in-app messages using `mqttClient` object.
    - Create mqtt connection
    - Handle mqtt connection, disconnection and failures
    - Subscribe to topics/user updates
    - Broadcast in-app message updates across clients
    - Republish messages locally
- File `IMIClient.js` is updated with below changes
    - Removed existing code for mqtt connection
    - Added BackgroundMessageListener method to listen for messages posted from ServiceWorker
    - Forwarded events received at BackgroundMessageListener to broadcast ConnectionStatus and MessagesArrived updates via `ICMessagingReceiver` callback.
    
### QA-DEMO-APP CHANGES
- Added webcomponent for displaying timestamps on ThreadsPage and MessagesPage. Prior to this, the timestamp was statically displayed. With the TimeStamp wc, the value is updated as time passes. For ex: now, a few secs ago, a minute ago, today..yesterday etc.

- Demo App was updated to handle local Republished messages + Minor fixes.
- File `imi-messages-page.js` was updated to handle locally republished messages and provide a `Retry` button. 
- Added shortcut `Shift+Enter` to send messages
- Minor fixes to scroll/UI

### Test Cases
#### General 
1. Goto QA-Demo-App, Register User: App should display 'Connecting', followed by 'Connected' status if server is reachable
0. Open a new window/tab for QA-Demo-App. This window/tab should also show the same Connection status as previous window/tab.
0. 

#### MOs
1. Goto New Conversation, Type the first message for thread. Publish. The same message and thread should be reflected across tabs/windows
2. Open any existing Thread/Conversation. Publish any message. The message should instantly be reflected across tabs. 


#### MOs Offline
1. Open any existing Thread/Conversation. Block calls to /mo url from Console->Network Tab. Publish any message. The message should fail to publish. Unpublished message should be reflected in Messages Page UI as a grey box with an option to `retry`. The same unpublished messages will be instantly reflected across tabs. 
2. Unblock Network calls to `mo` url. Retry sending Unpublished message from original window. THe message should now be Sent and republished across all tabs. The original grey-box on screen should be removed.
3. Try same steps as #2 above and click `retry` from any of the other tabs.

NOTE: Unsent MOs are not stored offline, hence any refresh will display fetchMessages result only.

#### MTs
1. Goto any Conversation, send an MT or ThreadAlert to the conversation. It should instantly be scene across all tabs. 
0. One and only One DR should be sent for any MT Message.
#### Network Connectivity Changes
1. While the App is `connected`. Go Offline. Wait few seconds and OnConnectionStatusChange should fire and status indicator should display `Disconnected`. All tabs will be disconnected. 
2. Going online again will automatically change the status to `Connected` across all tabs
3. `Offline & online switching needs to check after some gap of 10 mins in the real world scenario.





### Glossary //TODO
#### ConnectedClients
#### Clients
#### Broadcast Updates
#### Locally republished
MOs broadcasted by ServiceWorker to all connectedClients are being called locallyRepublished.
#### Unsent Messages
Locally Republished message is an MO and is broadcasted across windows/tabs using connectedClients listening for MQTT messages reposted from service worker 


## 1.6.3.073
- https://imimobile.atlassian.net/browse/WXCNCT-28802 - Add TPS Limiting for Typing Indicator Events in SDK
### CHANGES
- Updated `publishTypingIndicator` events for threads with a 5-second rate limit per thread.
- Suppressed duplicate or in-progress events and ensured callback invocation (success or rejection).
- Introduced `_typingState` to manage typing states for each thread ID.
- Implemented cleanup of `_typingState` for entries older than 5 seconds and not in progress.
- Updated imi-icmesage-input to call `publishTypingIndicator` on keypress event also
- Updated imi-icmesage-input to attach or detach calls to `publishTypingIndicator` 


## 1.5.2.032
 - https://imimobile.atlassian.net/browse/WXCNCT-15788

## 1.5.1.029
Merged changes from 15415 and 15304.


## 1.4.1.25
https://imimobile.atlassian.net/browse/WXCNCT-15304 

## 1.4.1.24
https://imimobile.atlassian.net/browse/WXCNCT-15319 (https://imimobile.atlassian.net/browse/WXCNCT-15293 parent)

## 1.4.1.023
- https://imimobile.atlassian.net/browse/WXCNCT-15145

## 1.4.0.022
- payLoad => payload renamed 

## 1.4.0.021
- https://imimobile.atlassian.net/browse/WXCNCT-13336?focusedCommentId=183479


## 1.4.0.020
- Changed version number to release.

## 1.3.4.019
- Fixed media issue


## 1.3.4.018
- Updated as per review comments.

## 1.3.4.017
- Updated as per review comments.

## 1.3.4.016
- Added autofill for ICMessage properties - appid,userid,deviceid,clientid
 - Introducing a new parameter called 'reference' in template and quick reply messages within SDKs for Livechat/ In-App channel
 https://imimobile.atlassian.net/browse/WXCNCT-13941 
 - JSSDK - SDK method to publish a postback
 https://imimobile.atlassian.net/browse/WXCNCT-13434
 -  Sending click receipts from app to backend system
https://imimobile.atlassian.net/browse/WXCNCT-13427


## 1.3.x.015
CustomTags - JSON object changed from customTags to customtags (small 't');

## 1.3.4.014
JS SDK - changed version to 1.3.4. Reserving 1.3.3 for 1.3.2 Patch 1 fix for customTags.


## 1.3.2.013
JS SDK- Getters for template message parameters
https://imimobile.atlassian.net/browse/IMICNCT-13431


## 1.3.2.012
JS SDK- Getters for template message parameters
https://imimobile.atlassian.net/browse/IMICNCT-13431

 <!-- JS SDK - Unregister failure callback need to handle error response properly
 https://imimobile.atlassian.net/browse/IMICNCT-12850 -->
## 1.3.2.011
Change unRegisterSecurityTokenListener to unregisterSecurityTokenListener

## 1.3.2.010
 JS SDK - Clean up registration data on Unregister Success
 https://imimobile.atlassian.net/browse/IMICNCT-12964

## 1.3.1.009
 JS SDK - Logs should be enabled based on the startUpLogger method call
 https://imimobile.atlassian.net/browse/IMICNCT-12852

## 1.3.1.008
 Registration success callback should return system generated userId
 https://imimobile.atlassian.net/browse/IMICNCT-12849

## 1.3.1.007
JS SDK - ICAttachment.fromJSON method contentType should be proper type. 
context: onFileUploadComplete. used for instantly displaying sent messages

## 1.3.1.006
JS SDK - unreadThreadCount - API response needs to be handled for encryption enabled

## 1.3.1.005
 JS SDK - Deprecate registerListener ,unRegisterListener & add registerSecurityTokenListener ,unRegisterSecurityTokenListener
 https://imimobile.atlassian.net/browse/IMICNCT-12816

## 1.3.1.004
JS SDK - SDK Technical enhancements
https://imimobile.atlassian.net/browse/IMICNCT-12652

## 1.3.1.003
Enhancements to Set Message Status (RR) method
https://imimobile.atlassian.net/browse/IMICNCT-12618

