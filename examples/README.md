# Example App

Demonstration app for `spark-js-sdk`.


## Getting Started:

1. Install dependencies

  ```bash
  npm install
  ```

2. Serve the app. You'll need to set several environment variables.

  ```bash
  export COMMON_IDENTITY_CLIENT_ID=<id>
  export COMMON_IDENTITY_CLIENT_SECRET=<secret>
  export COMMON_IDENTITY_REDIRECT_URI=<redirect_uri>
  export NODE_ENV=development
  grunt serve
  ```

3. Load the app

  Then navigate to `127.0.0.1:8000` to view the application.

  **NOTE:** Use the local IP address instead of `localhost` for OAuth redirect purposes.
