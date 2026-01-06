import {deleteNestedObjectsWithHtMeta} from '../../../../src/hashTree/utils';

import {assert} from '@webex/test-helper-chai';

describe('Hash Tree Utils', () => {
  describe('#deleteNestedObjectsWithHtMeta', () => {
    it('should delete nested objects with htMeta', () => {
      const locusPart = {
        a: {
          htMeta: {
            id: '1',
          },
          value: 'to be deleted',
        },
        b: {
          c: {
            htMeta: {
              id: '2',
            },
            value: 'to be deleted',
          },
          d: 'to be kept',
        },
        e: [
          {
            htMeta: {
              id: '3',
            },
            value: 'to be deleted',
          },
          {
            f: 'to be kept',
          },
          {
            htMeta: {
              id: '4',
            },
            value: 'to be deleted',
          },
          {
            g: 'to be kept',
          },
        ],
      };

      deleteNestedObjectsWithHtMeta(locusPart);

      assert.deepEqual(locusPart, {
        b: {
          d: 'to be kept',
        },
        e: [
          {
            f: 'to be kept',
          },
          {
            g: 'to be kept',
          },
        ],
      });
    });

    it('should handle arrays correctly', () => {
      const locusPart = {
        htMeta: {
          id: '0', // this should not be deleted
        },
        participants: [
          {
            htMeta: {
              id: '1',
            },
            id: 'participant1',
            value: 'to be deleted',
          },
          {
            htMeta: {
              id: '2',
            },
            id: 'participant2',
            value: 'to be deleted',
          },
        ],
        self: {
          htMeta: {
            id: '3',
          },
          id: 'self1',
          value: 'to be deleted',
        },
      };

      deleteNestedObjectsWithHtMeta(locusPart);

      assert.deepEqual(locusPart, {
        htMeta: {
          id: '0',
        },
        participants: [],
      });
    });
  });
});
