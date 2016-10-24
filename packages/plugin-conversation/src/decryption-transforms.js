import {
  curry
} from 'lodash';
import S from 'string';

import toArray from './to-array';

const decryptTextProp = curry((name, ctx, key, object) => ctx.transform(`decryptTextProp`, name, key, object));

export const transforms = toArray(`inbound`, {
  decryptObject(ctx, key, object) {
    if (!object) {
      object = key;
      key = undefined;
    }

    if (!object) {
      return Promise.resolve();
    }

    if (!object.objectType) {
      return Promise.resolve();
    }

    if (!key && object.encryptionKeyUrl) {
      key = object.encryptionKeyUrl;
    }

    return ctx.transform(`decrypt${S(object.objectType).capitalize().s}`, key, object);
  },

  decryptConversation(ctx, key, conversation) {
    const promises = [];
    if (conversation.activities.items) {
      promises.push(Promise.all(conversation.activities.items.map((item) => ctx.transform(`decryptObject`, null, item))));
    }

    const usableKey = conversation.encryptionKeyUrl || key;
    if (usableKey) {
      promises.push(ctx.transform(`decryptPropDisplayName`, usableKey, conversation));
      promises.push(ctx.transform(`decryptPropContent`, usableKey, conversation));
    }

    return Promise.all(promises);
  },

  decryptActivity(ctx, key, activity) {
    if (!activity.encryptionKeyUrl && !(activity.object && activity.object.encryptionKeyUrl)) {
      return Promise.resolve(activity);
    }

    const keyUrl = activity.encryptionKeyUrl || activity.object.encryptionKeyUrl || key;
    return ctx.transform(`decryptObject`, keyUrl, activity.object);
  },

  decryptComment(ctx, key, comment) {
    return Promise.all([
      ctx.transform(`decryptPropDisplayName`, key, comment),
      ctx.transform(`decryptPropContent`, key, comment)
    ]);
  },

  decryptContent(ctx, key, content) {
    const promises = content.files.items.map((item) => ctx.transform(`decryptObject`, key, item));
    promises.push(ctx.transform(`decryptComment`, key, content));

    return Promise.all(promises);
  },

  decryptEvent(ctx, key, event) {
    const promises = [
      ctx.transform(`decryptPropDisplayName`, key, event)
    ];

    if (event.location && event.location.split(`.`).length === 5) {
      promises.push(ctx.transform(`decryptPropLocation`, key, event));
    }

    return Promise.all(promises);
  },

  decryptFile(ctx, key, file) {
    return Promise.all([
      file.transcodedCollection && Promise.all(file.transcodedCollection.items.map((item) => ctx.transform(`decryptObject`, key, item))),
      ctx.transform(`decryptPropScr`, key, file),
      ctx.transform(`decryptPropDisplayName`, key, file),
      ctx.transform(`decryptPropContent`, key, file),
      file.image && ctx.transform(`decryptPropScr`, key, file.image)
    ]);
  },

  decryptTranscodedContent(ctx, key, transcodedContent) {
    return Promise.all(transcodedContent.files.items.map((item) => ctx.transform(`decryptFile`, key, item)));
  },

  decryptImageURI(ctx, key, imageURI) {
    return ctx.transform(`decryptPropLocation`, key, imageURI);
  },

  decryptTextProp(ctx, name, key, object) {
    if (!object[name]) {
      return Promise.resolve();
    }

    return ctx.spark.encryption.decryptText(key, object[name])
      .then((plaintext) => {
        object[name] = plaintext;
      })
      .catch((reason) => {
        ctx.spark.logger.warn(`plugin-conversation: failed to decrypt ${name}`);
        return Promise.reject(reason);
      });
  },

  decryptPropDisplayName: decryptTextProp(`displayName`),

  decryptPropContent: decryptTextProp(`content`),

  decryptPropScr(ctx, key, object) {
    return ctx.spark.encryption.decryptScr(key, object.scr)
      .then((scr) => {
        object.scr = scr;
      });
  },
  decryptPropLocation: decryptTextProp(`location`)
});
