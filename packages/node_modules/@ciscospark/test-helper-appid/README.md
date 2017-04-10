# @ciscospark/test-helper-appid

See https://ciscospark.github.io/spark-js-sdk/

Test helper for creating App-ID users.

## `testHelperAppId.createUser(options)`

Wrapper around router which will will make an API call from a web browser or directly invoke `jsonwebtoken` in node. Only require option is `subject`.

## `testHelperAppId.router`

Express router which will create a JWT from a POST request. Only required body parameter is `subject`. Use with

```javascript
app.use('/jwt', require('@ciscospark/test-helper-appid').router);
```
