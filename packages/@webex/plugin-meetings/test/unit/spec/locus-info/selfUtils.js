import {assert} from '@webex/test-helper-chai';
import Sinon from 'sinon';
import {cloneDeep} from 'lodash';
import SelfUtils from '@webex/plugin-meetings/src/locus-info/selfUtils';

import {self} from './lib/selfConstant';

describe('plugin-meetings', () => {
  describe('selfUtils', () => {
    describe('layoutChanged', () => {
      it('should return true if the layout has changed', () => {
        const parsedSelf = SelfUtils.parse(self);
        const clonedSelf = cloneDeep(parsedSelf);

        clonedSelf.layout = 'DIFFERENT';

        assert.deepEqual(SelfUtils.layoutChanged(parsedSelf, clonedSelf), true);
      });

      it('should return false if the layout has not changed', () => {
        const parsedSelf = SelfUtils.parse(self);

        assert.deepEqual(SelfUtils.layoutChanged(parsedSelf, parsedSelf), false);
      });
    });

    describe('parse', () => {
      it('parse calls getRoles and returns the resulting roles', () => {
        const getRolesSpy = Sinon.spy(SelfUtils, 'getRoles');

        const parsedSelf = SelfUtils.parse(self);

        assert.calledWith(getRolesSpy, self);

        assert.deepEqual(parsedSelf.roles, ['PRESENTER']);
      });

      it('calls getLayout and returns the resulting layout', () => {
        const spy = Sinon.spy(SelfUtils, 'getLayout');
        const parsedSelf = SelfUtils.parse(self);

        assert.calledWith(spy, self);
        assert.deepEqual(parsedSelf.layout, self.controls.layouts[0].type);
      });
    });

    describe('getLayout', () => {
      it('should get supplied layout', () => {
        assert.deepEqual(SelfUtils.getLayout(self), self.controls.layouts[0].type);
      });

      it('should return undefined if the new self does not have a provided layout', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.controls.layouts;

        assert.deepEqual(SelfUtils.getLayout(mutatedSelf), undefined);
      });
    });

    describe('canNotViewTheParticipantList', () => {
      it('should return the correct value', () => {
        assert.equal(
          SelfUtils.canNotViewTheParticipantList(self),
          self.canNotViewTheParticipantList
        );
      });

      it('should return false if the new self does not have a value', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.canNotViewTheParticipantList;

        assert.equal(SelfUtils.canNotViewTheParticipantList(mutatedSelf), false);
      });
    });

    describe('isSharingBlocked', () => {
      it('should return the correct value', () => {
        assert.equal(SelfUtils.isSharingBlocked(self), self.isSharingBlocked);
      });

      it('should return false if the new self does not have a value', () => {
        const mutatedSelf = cloneDeep(self);

        delete mutatedSelf.isSharingBlocked;

        assert.equal(SelfUtils.isSharingBlocked(mutatedSelf), false);
      });
    });

    describe('getRoles', () => {
      it('get roles works', () => {
        assert.deepEqual(SelfUtils.getRoles(self), ['PRESENTER']);

        assert.deepEqual(
          SelfUtils.getRoles({
            controls: {
              role: {roles: [{type: 'SOME_ARBITRARY_ROLE', hasRole: true}]},
            },
          }),
          ['SOME_ARBITRARY_ROLE']
        );

        assert.deepEqual(
          SelfUtils.getRoles({
            controls: {
              role: {roles: [{type: 'SOME_ARBITRARY_ROLE', hasRole: false}]},
            },
          }),
          []
        );

        assert.deepEqual(SelfUtils.getRoles({}), []);
        assert.deepEqual(SelfUtils.getRoles(), []);
      });
    });

    describe('getSelves', () => {
      describe('canNotViewTheParticipantListChanged', () => {
        it('should return canNotViewTheParticipantListChanged = true when changed', () => {
          const clonedSelf = cloneDeep(self);

          clonedSelf.canNotViewTheParticipantList = true; // different

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.canNotViewTheParticipantListChanged, true);
        });

        it('should return canNotViewTheParticipantListChanged = false when unchanged', () => {
          const clonedSelf = cloneDeep(self);

          clonedSelf.canNotViewTheParticipantList = false; // same

          const {updates} = SelfUtils.getSelves(self, clonedSelf);

          assert.equal(updates.canNotViewTheParticipantListChanged, false);
        });
      });
    });

    describe('isSharingBlocked', () => {
      it('should return isSharingBlockedChanged = true when changed', () => {
        const clonedSelf = cloneDeep(self);

        clonedSelf.isSharingBlocked = true; // different

        const {updates} = SelfUtils.getSelves(self, clonedSelf);

        assert.equal(updates.isSharingBlockedChanged, true);
      });

      it('should return isSharingBlockedChanged = false when unchanged', () => {
        const clonedSelf = cloneDeep(self);

        clonedSelf.isSharingBlocked = false; // same

        const {updates} = SelfUtils.getSelves(self, clonedSelf);

        assert.equal(updates.isSharingBlockedChanged, false);
      });
    });
  });

  describe('isJoined', () => {
    it(' returns true if state is joined', () => {
      assert.deepEqual(SelfUtils.isJoined(self), true);
    });

    it(' returns true if state is not joined', () => {
      const customSelf = {...self, state: 'NOT_JOINED'};

      assert.deepEqual(SelfUtils.isJoined(customSelf), false);
    });

    it(' returns true if state is empty', () => {
      const customSelf = {...self};

      delete customSelf.state;

      assert.deepEqual(SelfUtils.isJoined(customSelf), false);
    });
  });
});
