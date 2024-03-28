/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Lyra, {config as lyraConfig} from '@webex/internal-plugin-lyra';

describe('plugin-lyra', () => {
  const lyraSpaceId = 'lyra-1337';
  const lyraSpaceUrl = `https://lyra/api/v1/${lyraSpaceId}`;
  const lyraSpace = {
    identity: {
      id: lyraSpaceId,
    },
    url: lyraSpaceUrl,
  };
  const conversation = {
    url: 'https://conversation',
    kmsResourceObjectUrl: 'https://kms',
  };

  let webex;

  beforeAll(() => {
    webex = new MockWebex({
      children: {
        lyra: Lyra,
      },
    });

    webex.internal.device = {
      url: 'deviceUrl',
      userId: '1234',
    };
    webex.config.lyra = lyraConfig.lyra;
  });

  beforeEach(() => {
    webex.request.resetHistory();
  });

  describe('space', () => {
    describe('#get()', () => {
      it('requires space.id', () =>
        assert.isRejected(webex.internal.lyra.space.get(), /space.id is required/));
    });

    describe('#join()', () => {
      it('defaults to MANUAL pass type', () =>
        webex.internal.lyra.space.join(lyraSpace).then(() =>
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'PUT',
              api: 'lyra',
              resource: `${lyraSpace.url}/occupants/@me`,
              body: {
                pass: {
                  type: 'MANUAL',
                },
                deviceUrl: 'deviceUrl',
              },
            })
          )
        ));

      it('allows other pass type', () =>
        webex.internal.lyra.space.join(lyraSpace, {passType: 'TEST'}).then(() =>
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'PUT',
              api: 'lyra',
              resource: `${lyraSpace.url}/occupants/@me`,
              body: {
                pass: {
                  type: 'TEST',
                },
                deviceUrl: 'deviceUrl',
              },
            })
          )
        ));

      it('allows another uri', () =>
        webex.internal.lyra.space.join(lyraSpace, {uri: 'https://customUrl'}).then(() =>
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'PUT',
              uri: 'https://customUrl',
              body: {
                pass: {
                  type: 'MANUAL',
                },
                deviceUrl: 'deviceUrl',
              },
            })
          )
        ));

      it('passes on extra data field', () =>
        webex.internal.lyra.space
          .join(lyraSpace, {
            passType: 'TEST',
            data: {proof: 'abc'},
          })
          .then(() =>
            assert.calledWith(
              webex.request,
              sinon.match({
                method: 'PUT',
                api: 'lyra',
                resource: `${lyraSpace.url}/occupants/@me`,
                body: {
                  pass: {
                    type: 'TEST',
                    data: {proof: 'abc'},
                  },
                  deviceUrl: 'deviceUrl',
                },
              })
            )
          ));
    });

    describe('#bindConversation()', () => {
      it('requires space.url', () =>
        assert.isRejected(webex.internal.lyra.space.bindConversation(), /space.url is required/));
      it('requires space.id', () =>
        assert.isRejected(
          webex.internal.lyra.space.bindConversation({url: lyraSpaceUrl}),
          /space.id is required/
        ));
      it('requires conversation.url', () =>
        assert.isRejected(
          webex.internal.lyra.space.bindConversation(lyraSpace, {kmsResourceObjectUrl: 'url'}),
          /conversation.url is required/
        ));
      it('requires conversation.kmsResourceObjectUrl', () =>
        assert.isRejected(
          webex.internal.lyra.space.bindConversation(lyraSpace, {url: 'url'}),
          /conversation.kmsResourceObjectUrl is required/
        ));
    });

    describe('#unbindConversation()', () => {
      it('requires space.url', () =>
        assert.isRejected(webex.internal.lyra.space.unbindConversation(), /space.url is required/));
      it('requires space.id', () =>
        assert.isRejected(
          webex.internal.lyra.space.unbindConversation({url: lyraSpaceUrl}),
          /space.id is required/
        ));
      it('requires conversation.url', () =>
        assert.isRejected(
          webex.internal.lyra.space.unbindConversation(lyraSpace, {kmsResourceObjectUrl: 'url'}),
          /conversation.url is required/
        ));
      it('requires conversation.kmsResourceObjectUrl', () =>
        assert.isRejected(
          webex.internal.lyra.space.unbindConversation(lyraSpace, {url: conversation.url}),
          /conversation.kmsResourceObjectUrl is required/
        ));
    });

    describe('#deleteBinding', () => {
      it('requires space.url', () =>
        assert.isRejected(webex.internal.lyra.space.deleteBinding(), /space.url is required/));
      it('requires space.id', () =>
        assert.isRejected(
          webex.internal.lyra.space.deleteBinding({url: lyraSpaceUrl}),
          /space.id is required/
        ));
      it('requires options.kmsResourceObjectUrl', () =>
        assert.isRejected(
          webex.internal.lyra.space.deleteBinding(lyraSpace, {bindingId: '123'}),
          /kmsResourceObjectUrl is required/
        ));
      it('requires options.bindingId', () =>
        assert.isRejected(
          webex.internal.lyra.space.deleteBinding(lyraSpace, {kmsResourceObjectUrl: 'url'}),
          /options.bindingId is required/
        ));
    });
  });
});
