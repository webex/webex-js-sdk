# Example: Postman

This is a basic Postman-like app for interacting with the Spark API.

## Running

`npm start`

## Configuring

You'll need an OAuth client with http://127.0.0.1:8000 as one of its valid `redirect_uris`. From there, load the app at http://127.0.0.1:800 and enter your client's `client_id`, `client_secret`, and desired `scope`. Alternatively, `client_id`, `client_secret`, and `scope` can be specified in a `.env` file in the example directory.
