import extendError from 'extend-error';

const KmsError = extendError({
  parseFn(body) {
    body = body.body || body;

    Object.defineProperties(this, {
      body: {
        enumerable: false,
        value: body
      },
      reason: {
        enumerable: false,
        value: body.reason
      },
      requestId: {
        enumerable: false,
        value: body.requestId
      },
      status: {
        enumerable: false,
        value: body.status
      }
    });

    return body.reason;
  },

  properties: {
    defaultMessage: `An error was received while communicating with the KMS`
  },

  subTypeName: `KmsError`
});

export default KmsError;
