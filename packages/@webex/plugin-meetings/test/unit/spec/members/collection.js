const { default: MembersCollection } = require("../../../../src/members/collection");
const { default: Member } = require("../../../../src/member");
const { assert } = require('@webex/test-helper-chai');


describe('plugin-meetings', () => {
  describe('MembersCollection', () => {
    let collection;
    let member1;
    let member2;
    const participant1 = { controls: {}, status: {} };
    const participant2 = { controls: {}, status: {} };

    beforeEach(() => {
      collection = new MembersCollection();
      member1 = new Member(participant1);
      member2 = new Member(participant2);
    });

    it('starts with no members', () => {
      assert.equal(Object.keys(collection.getAll()).length, 0);
    });

    it('can add members', () => {      
      collection.set('member1', member1);
      assert.equal(Object.keys(collection.getAll()).length, 1);
      assert.equal(collection.get('member1'), member1);

      collection.set('member2', member2);
      assert.equal(Object.keys(collection.getAll()).length, 2);
      assert.equal(collection.get('member2'), member2);
    });

    it('can remove members', () => {
      // Add some members first
      collection.set('member1', member1);
      collection.set('member2', member2);
      assert.equal(Object.keys(collection.getAll()).length, 2);

      // Remove one member
      collection.remove('member1');
      assert.equal(Object.keys(collection.getAll()).length, 1);
      assert.equal(collection.get('member1'), undefined);
      assert.equal(collection.get('member2'), member2);

      // Remove another member
      collection.remove('member2');
      assert.equal(Object.keys(collection.getAll()).length, 0);
      assert.equal(collection.get('member2'), undefined);

      // Removing non-existent member should not cause errors
      collection.remove('nonExistent');
      assert.equal(Object.keys(collection.getAll()).length, 0);
    });

    describe('reset', () => {
      it('removes all members', () => {
        // Add some members first
        collection.set('member1', member1);
        collection.set('member2', member2);
        assert.equal(Object.keys(collection.getAll()).length, 2);

        // Reset should clear all members
        collection.reset();
        assert.equal(Object.keys(collection.getAll()).length, 0);
        assert.equal(collection.get('member1'), undefined);
        assert.equal(collection.get('member2'), undefined);
      });
    });

    describe('setAll', () => {
      it('replaces all members with new collection', () => {
        // Add initial member
        collection.set('member1', member1);
        assert.equal(Object.keys(collection.getAll()).length, 1);

        // Set all with new collection
        const newMembers = {
          'member2': member2,
          'member3': new Member(participant1)
        };
        collection.setAll(newMembers);

        assert.equal(Object.keys(collection.getAll()).length, 2);
        assert.equal(collection.get('member1'), undefined);
        assert.equal(collection.get('member2'), member2);
        assert.exists(collection.get('member3'));
      });
    });

    describe('get', () => {
      it('returns undefined for non-existent members', () => {
        assert.equal(collection.get('nonExistent'), undefined);
      });

      it('returns correct member for existing id', () => {
        collection.set('member1', member1);
        assert.equal(collection.get('member1'), member1);
      });
    });

    describe('getAll', () => {
      it('returns empty object when no members', () => {
        const allMembers = collection.getAll();
        assert.isObject(allMembers);
        assert.equal(Object.keys(allMembers).length, 0);
      });

      it('returns all members', () => {
        collection.set('member1', member1);
        collection.set('member2', member2);
        
        const allMembers = collection.getAll();
        assert.equal(Object.keys(allMembers).length, 2);
        assert.equal(allMembers.member1, member1);
        assert.equal(allMembers.member2, member2);
      });
    });
  });
});