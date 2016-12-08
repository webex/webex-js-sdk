# How to use the Message Meet Widget

Our widget is built using React (https://github.com/facebook/react), Redux (https://github.com/reactjs/redux), and the Spark JS SDK (https://github.com/ciscospark/spark-js-sdk).

Depending on how comfortable you are with these frameworks, there are are a number of ways you can use the widget on your website and in your code.

## Data Attribute

The easiest way to get the Spark Message Meet Widget into your web site is to add the built resources and attach data attributes to your a container.

1. Follow these instructions to checkout and build the SDK (https://github.com/ciscospark/spark-js-sdk/blob/master/README.md)
1. From the root of the sdk repo, run the following to build the widget:
```sh
PACKAGE=widget-message-meet npm run grunt:package -- build
```
1. Locate the `package/widget-message-meet/dist` directory.
1. Copy the resources in the `dist` directory to own project and add a `<script />` tag to your page to include the `bundle.js` and a `<link />` tag to include `main.css`.
1. Create a container where you which to include the message meet widget and add the following attributes to configure the widget:
  * `data-toggle="spark-message-meet"`: (required)
  * `data-access-token`: Access token for the user account that is initiating the message/meet session. For testing purposes you can use a developer access token from https://developers.ciscospark.com
  * `data-user-id`: User Id or email of the target user.
```html
<div class="message-meet-widget-container"
  data-toggle="spark-message-meet"
  data-access-token="XXXXXXXXXXXXXXXXXXXXXX"
  data-user-id="sparky@ciscospark.com"
  />
```
