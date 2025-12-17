import {isArray} from 'lodash';
/**
 * Encrypt text property of an object - Note: this is backup solution for encryption, the better solution is to use interceptors and needs migration later
 * @param {object} [ctx] context
 * @param {string} [name] property name
 * @param {string|object} [key] encryption key or key uri
 * @param {object} [object] object which contains the property
 * @returns {Promise} Resolves when encryption is complete
 */
const _encryptTextProp = (ctx, name, key, object) => {
  if (!object[name]) {
    return Promise.resolve();
  }

  return ctx.webex.internal.encryption
    .encryptText(key.uri || key, object[name])
    .then((ciphertext) => {
      object[name] = ciphertext;
    });
};

const EncryptHelper = {
  /**
   * Encrypt create / update task event request payload
   * @param {object} [ctx] context
   * @param {object} [data] task payload data
   * @returns {Promise} Resolves with encrypted request payload
   * */
  encryptTaskRequest: (ctx, data) => {
    if (data.encryptionKeyUrl) {
      return Promise.all([
        _encryptTextProp(ctx, 'title', data.encryptionKeyUrl, data),
        _encryptTextProp(ctx, 'notes', data.encryptionKeyUrl, data),
      ]);
    }

    return ctx.webex.internal.encryption.kms.createUnboundKeys({count: 1}).then((keys) => {
      const key = isArray(keys) ? keys[0] : keys;
      const encryptionKeyUrl = key.uri;
      Object.assign(data, {encryptionKeyUrl});

      return Promise.all([
        _encryptTextProp(ctx, 'title', encryptionKeyUrl, data),
        _encryptTextProp(ctx, 'notes', encryptionKeyUrl, data),
      ]);
    });
  },
};

export default EncryptHelper;
