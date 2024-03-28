/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
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

  let webex;

  beforeAll(() => {
    webex = new MockWebex({
      children: {
        lyra: Lyra,
      },
      device: {
        url: 'deviceUrl',
        userId: '1234',
      },
    });

    webex.config.lyra = lyraConfig.lyra;
  });

  beforeEach(() => {
    webex.request.resetHistory();
  });

  describe('device', () => {
    describe('#putAudioState', () => {
      it('requires audioState.deviceUrl', () =>
        assert.isRejected(
          webex.internal.lyra.device.putAudioState(lyraSpace),
          /audioState.deviceUrl is required/
        ));
    });

    describe('#setVolume', () => {
      it('defaults to level 0', () =>
        webex.internal.lyra.device.setVolume(lyraSpace).then(() => {
          assert.calledWith(
            webex.request,
            sinon.match({
              method: 'POST',
              uri: `${lyraSpace.url}/audio/volume/actions/set/invoke`,
              body: {
                level: 0,
              },
            })
          );
        }));
    });
  });
});
