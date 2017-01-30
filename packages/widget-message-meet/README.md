# Spark Message and Meet Widget _(widget-message-meet)_

* THIS WIDGET CONTAINS EXPERIMENTAL CODE *

> The Spark Message Meet widget allows developers to easily incorporate Cisco Spark 1 on 1 messaging into an application.

## Table of Contents
-   [Background](#background)
-   [Install](#install)
    -   [CDN](#cdn)
    -   [Build from Source](#build-from-source)
-   [Usage](#usage)
    -   [Quick Start](#quick-start)
    -   [HTML](#html)
    -   [JSX](#jsx)
-   [Browser Support](#browser-support)

## Background

This widget handles the heavy lifting of coordinating between your application and the Spark APIs, and provides components of the Spark messaging experience without having to build all front end UI yourself.

Our widget is built using React <https://github.com/facebook/react>, Redux <https://github.com/reactjs/redux>, and the Spark Javascript SDK <https://github.com/ciscospark/spark-js-sdk>.

This widget supports:
-   1 on 1 messaging
-   Inline Markdown
-   Sharing of files and documents
-   Preview and download of files and documents
-   Flagging messages for follow up

## Install

Depending on how comfortable you are with these frameworks, there are are a number of ways you can "install" our code.

### Spark for Developers

If you haven't already, go to the Spark for Developers Portal (<https://developers.ciscospark.com>) and sign up for an account. Once you've created an account you can get your developer access token by clicking on your avatar at the top right of the screen.

When you want to eventually create an integration and have your own users take advantage of the widget, you'll need to create an integration with the following scopes:

  ```
  spark:kms
  spark:rooms_read
  spark:rooms_write
  spark:memberships_read
  spark:memberships_write
  spark:messages_read
  spark:messages_write
  ```

Head over to the Spark for Developers Documentation for more information about how to setup OAuth for your app: <https://developer.ciscospark.com/authentication.html>

### CDN

Using our CDN requires the least amount of work to get started. Add the following into your HTML file:
```
<!-- Latest compiled and minified CSS -->
<link rel="stylesheet" href="https://code.s4d.io/widget-message-meet/production/main.css">

<!-- Latest compiled and minified JavaScript -->
<script src="https://code.s4d.io/widget-message-meet/production/bundle.js"></script>
```

### Build from Source

1.  Follow these instructions to checkout and build the SDK <https://github.com/ciscospark/spark-js-sdk/blob/master/README.md>
1.  Be sure to run `npm install` and `npm run bootstrap` from the root of the sdk repo. You will want to run this every time you pull down any new updates for the sdk.
1.  From the root of the sdk repo, run the following to build the widget:

  ```sh
  PACKAGE=widget-message-meet npm run grunt:package -- build
  ```
1.  The built bundles are located at `package/widget-message-meet/dist`.

## Usage

### Quick Start

If you would just like to get running immediately follow these instructions to get a webpack-dev-server running with the widget.

1.  Create a `.env` file in the root of the SDK project with the following lines, replacing the Xs with the appropriate value:

    ```
    CISCOSPARK_ACCESS_TOKEN=YOUR_ACCESS_TOKEN
    TO_PERSON_EMAIL=XXXXX@XXXXXXXXX
    ```
1.  From the root directory run: `PACKAGE=widget-message-meet npm run grunt:package serve`

### HTML

The easiest way to get the Spark Message and Meet Widget into your web site is to add the built resources and attach data attributes to your a container.

1.  If you're using our CDN, skip to step 2.
  -  Copy the resources in the `dist` directory to own project.
  -  Add a `<script />` tag to your page to include the `bundle.js`
  -  Add a `<link />` tag to include `main.css`
1.  Create a container where you would like to embed the widget and add the following attributes to configure the widget:
  - `data-toggle="spark-message-meet"`: (required)
  - `data-access-token`: (required) Access token for the user account initiating the messaging session. For testing purposes you can use a developer access token from <https://developers.ciscospark.com>.
  - Include one of the following attributes:
    - `data-to-person-email`: Email of the message recipient.
    - `data-to-person-id`: User Id of the message recipient.

    ```html
    <div
      data-toggle="spark-message-meet"
      data-access-token="YOUR_ACCESS_TOKEN"
      data-to-person-email="XXXXX@XXXXXXXXX"
      />
    ```

### JSX

Because our widgets are built using React, you'll be able to directly import the modules and components into your React app.

Replace `YOUR_ACCESS_TOKEN` with the access token of the user who is going to be sending the messages (for development purposes this can just be your Developer Access Token), `TARGET_USER_EMAIL` with the email of the user who is receiving the messages, and `ELEMENT` with the ID of the element you want to inject into.

If you have the User ID of the recipient, you may provide that in the property `toPersonId` of `MessageMeetWidget` instead of using `toPersonEmail`.

```javascript
import MessageMeetWidget from '@ciscospark/widget-message-meet';

ReactDOM.render(
  <MessageMeetWidget accessToken="YOUR_ACCESS_TOKEN" toPersonEmail="TARGET_USER_EMAIL" />,
  document.getElementById('ELEMENT')
);
```

## Browser Support

This widget supports the follow browsers:
-   Current release of Chrome
-   Current release of Firefox
-   Internet Explorer 11 or later

## Contribute

Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for more details.

## License

&copy; 2016 Cisco and/or its affiliates. All Rights Reserved.
