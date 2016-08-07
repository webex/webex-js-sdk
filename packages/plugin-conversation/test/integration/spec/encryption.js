/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

describe(`Plugin : Conversation`, () => {
  describe(`when interacting with a non-encrypted conversation`, () => {
    describe(`when the conversation is a grouped conversation`, () => {
      describe(`#add()`, () => {
        it(`adds the specified user`);
      });

      describe(`#leave()`, () => {
        it(`removes the current user`);
        it(`removes the specified user`);
      });

      describe(`#post()`, () => {
        it(`posts a message`);
      });

      describe(`#update()`, () => {
        it(`sets the conversation's title`);
      });
    });

    describe(`when the conversation is a 1:1 conversation`, () => {
      describe(`#post()`, () => {
        it(`posts a message`);
      });
    });
  });
});
