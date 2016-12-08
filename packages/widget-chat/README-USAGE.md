# Spark Message and Meet Widget

The Spark Message and Meet widget allows developers to quickly and easily incorporate messaging through Cisco Spark into an application. This widget handles the heavy lifting of coordinating between your application and the Spark APIs, and provides a complete Spark UI and messaging experience without having to build all front end UI yourself.

Our widget is built using React <https://github.com/facebook/react>, Redux <https://github.com/reactjs/redux>, and the Spark JS SDK <https://github.com/ciscospark/spark-js-sdk>. This allows a developer to extend the UI to support different messaging contexts.

## Table of Contents
-   [Features](#features)
-   [Getting Started](#getting-started)
    -   [CDN](#cdn)
    -   [Build from Source](#build-from-source)
-   [Usage](#usage)
    -   [HTML](#html)
    -   [JSX](#jsx)
-   [Browser Support](#browser-support)

## Features

Currently, this widget supports:
-   Basic text based messaging
-   Inline Markdown
-   Sharing of files and documents
-   Preview and download of files and documents
-   Flagging messages for follow up

## Getting Started

Depending on how comfortable you are with these frameworks, there are are a number of ways you can "install" our code.

### CDN

Using our CDN requires the least amount of work to get started. To get started, add the following into your HTML file:
```
<!-- Latest compiled and minified CSS -->
<link rel="stylesheet" href="https://code.s4d.io/widget-message-meet/main.css">

<!-- Latest compiled and minified JavaScript -->
<script src="https://code.s4d.io/widget-message-meet/bundle.js"></script>
```

### Build from Source

1.  Follow these instructions to checkout and build the SDK <https://github.com/ciscospark/spark-js-sdk/blob/master/README.md>
1.  From the root of the sdk repo, run the following to build the widget:

  ```sh
  PACKAGE=widget-chat npm run grunt:package -- build
  ```
1.  The built bundles are located at `package/widget-chat/dist`.

## Usage

### HTML

The easiest way to get the Spark Chat Widget into your web site is to add the built resources and attach data attributes to your a container.

1.  If you're using our CDN, skip to step 2.
  -  Copy the resources in the `dist` directory to own project and add a `<script />` tag to your page to include the `bundle.js` and a `<link />` tag to include `main.css`.
1.  Create a container where you which to include the chat widget and add the following attributes to configure the widget:
  - `data-toggle="spark-chat"`: (required)
  - `data-access-token`: Access token for the user account that is initiating the chat session. For testing purposes you can use a developer access token from <https://developers.ciscospark.com>
  - `data-user-id`: User Id or email of the target user.

    ```html
    <div class="chat-widget-container"
      data-toggle="spark-chat"
      data-access-token="XXXXXXXXXXXXXXXXXXXXXX"
      data-user-id="sparky@ciscospark.com"
      />
    ```

### JSX

Because our widgets are built using React, you'll be able to directly import the modules and components into your React app.

Replace `YOUR_ACCESS_TOKEN` with the access token of the user who is going to be sending the messages (for development purposes this can just be your Developer Access Token), `TARGET_USER_EMAIL` with the email of the user who is recieving the messages, and `ELEMENT` with the ID of the element you want to inject into.

```javascript
import MessageMeetWidget from '@ciscospark/widget-message-meet';

ReactDOM.render(
  <MessageMeetWidget accessToken="YOUR_ACCESS_TOKEN" userId="TARGET_USER_EMAIL" />,
  document.getElementById('ELEMENT')
);
```

## Browser Support

This widget supports the follow browsers:
-   Current release of Chrome
-   Current releaes of Firefox
-   Internet Explorer 11 or later
