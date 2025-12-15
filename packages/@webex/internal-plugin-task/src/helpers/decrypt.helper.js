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

/**
 * Decrypt entities array in actionItem
 * @param {object} [ctx] context
 * @param {string} [key] encryption key uri
 * @param {Array} [entities] entities array
 * @returns {Promise} Resolves when decryption is complete
 */
const _decryptEntities = (ctx, key, entities) => {
  if (!entities || !Array.isArray(entities)) {
    return Promise.resolve();
  }

  const decryptPromises = [];

  entities.forEach((entity) => {
    // Decrypt entity text
    decryptPromises.push(_decryptTextProp(ctx, 'text', key, entity));

    // Decrypt entity metadata if exists
    if (entity.metadata) {
      decryptPromises.push(_decryptTextProp(ctx, 'email', key, entity.metadata));
      decryptPromises.push(_decryptTextProp(ctx, 'instruction', key, entity.metadata));
    }
  });

  return Promise.all(decryptPromises);
};

/**
 * Decrypt actionItem fields
 * @param {object} [ctx] context
 * @param {string} [key] encryption key uri
 * @param {object} [actionItem] actionItem object
 * @returns {Promise} Resolves when decryption is complete
 */
const _decryptActionItem = (ctx, key, actionItem) => {
  if (!actionItem) {
    return Promise.resolve();
  }

  return Promise.all([
    _decryptTextProp(ctx, 'editedContent', key, actionItem),
    _decryptTextProp(ctx, 'aiGeneratedContent', key, actionItem),
    _decryptEntities(ctx, key, actionItem.entities),
    _decryptEntities(ctx, key, actionItem.editedEntities),
  ]);
};

const _decryptTaskFields = (ctx, item) => {
  if (!item || !item.encryptionKeyUrl) {
    return Promise.resolve();
  }

  return Promise.all([
    _decryptTextProp(ctx, 'title', item.encryptionKeyUrl, item),
    _decryptTextProp(ctx, 'notes', item.encryptionKeyUrl, item),
    _decryptActionItem(ctx, item.encryptionKeyUrl, item.actionItem),
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
