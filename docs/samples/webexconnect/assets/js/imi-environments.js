// This file is intentionally non-functional for real connections. To test with
// real credentials, use the "paste a config JSON" panel on index.html /
// api-demo.html (initWithDynamicConfig), which stores your config only in
// sessionStorage and never touches this committed file.

var imiEnvironments = {
  target: "PLACEHOLDER_APP_ID",
  "PLACEHOLDER_APP_ID": {
    "asset": {
      "appId": "PLACEHOLDER_APP_ID",
      "appSecret": "REDACTED_APP_SECRET",
      "pathConfig": {
        "assetPath": "/samples/webexconnect/assets/",
        "root": "/samples/webexconnect/"
      }
    },
    "imiclient": {
      "shouldRequestNotificationPermission": true,
      "config": {
        "storageBucket": "placeholder-project.appspot.com",
        "apiKey": "REDACTED_FIREBASE_API_KEY",
        "messagingSenderId": "000000000000",
        "appId": "1:000000000000:web:0000000000000000000000",
        "projectId": "placeholder-project",
        "measurementId": "G-XXXXXXXXXX",
        "databaseURL": "https://placeholder-project.firebaseio.com",
        "authDomain": "placeholder-project.firebaseapp.com"
      },
      "imipush": {
        "safariWebPushId": "web.com.imiconnect.safari.webpush"
      },
      "authdomain": "https://rtm.imiconnect.co/rtmsAPI",
      "rtmsdomain": "rtm.imiconnect.co",
      "safariRegisterURL": "https://rtm.imiconnect.co/apnpweb/"
    },
    "sw": {
      "config": {
        "messagingSenderId": "000000000000",
        "serverUrl": "https://rtm.imiconnect.co",
        "appid": "PLACEHOLDER_APP_ID"
      }
    }
  }
};
