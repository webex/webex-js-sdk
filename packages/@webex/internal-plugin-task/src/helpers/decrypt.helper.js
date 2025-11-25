/**
 * Decrypt text property - Note: this is backup solution for decryption, the better solution is to use interceptors and needs migration later
 * @param {object} [ctx] context
 * @param {string} [name] property name
 * @param {string|object} [key] encryption key or key uri
 * @param {object} [object] object which contains the property
 * @returns {Promise} Resolves when decryption is complete
 */
const _decryptTextProp = (ctx, name, key, object) => {
  if (!object[name]) {
    return Promise.resolve();
  }

  return ctx.webex.internal.encryption
    .decryptText(key.uri || key, object[name])
    .then((plaintext) => {
      object[name] = plaintext;
    });
};

const _decryptTaskFields = (ctx, item) => {
  if (!item || !item.encryptionKeyUrl) {
    return Promise.resolve();
  }

  return Promise.all([
    _decryptTextProp(ctx, 'title', item.encryptionKeyUrl, item),
    _decryptTextProp(ctx, 'notes', item.encryptionKeyUrl, item),
  ]);
};

const DecryptHelper = {
  /**
   * Decrypt task response
   * @param {object} [ctx] context
   * @param {object} [data] task response
   * @returns {Promise} Resolves with decrypted response
   * */
  decryptTaskResponse: (ctx, data) => {
    return _decryptTaskFields(ctx, data);
  },

  /**
   * Decrypt tasks response
   * @param {object} [ctx] context
   * @param {object} [data] tasks response
   * @returns {Promise} Resolves with decrypted response
   * */
  decryptTasksResponse: (ctx, data) => {
    if (!data || !data.items || data.items.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(data.items.map((task) => _decryptTaskFields(ctx, task)));
  },
};

export default DecryptHelper;
