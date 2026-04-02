import {HashTreeObject, ObjectType} from '../../../../src/hashTree/types';
import {
  deleteNestedObjectsWithHtMeta,
  isSelf,
  sortByInitPriority,
} from '../../../../src/hashTree/utils';
import {DataSetNames, DATA_SET_INIT_PRIORITY} from '../../../../src/hashTree/constants';

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

  describe('#isSelf', () => {
    ['self', 'SELF', 'Self'].forEach((type) => {
      it(`should return true for object with type="${type}"`, () => {
        const selfObject = {
          htMeta: {
            elementId: {
              type,
              id: 1,
              version: 1,
            },
            dataSetNames: [],
          },
          data: {},
        };

        assert.isTrue(isSelf(selfObject as HashTreeObject));
      });
    });

    it('should return false for non-self object', () => {
      const participantObject = {
        htMeta: {
          elementId: {
            type: ObjectType.participant,
            id: 2,
            version: 1,
          },
          dataSetNames: [],
        },
        data: {},
      };

      assert.isFalse(isSelf(participantObject));
    });
  });

  describe('#sortByInitPriority', () => {
    [
      {
        description: 'places "main" and "self" first when both appear',
        input: ['atd-active', 'main', 'atd-unmuted', 'self'],
        expected: ['main', 'self', 'atd-active', 'atd-unmuted'],
      },
      {
        description: 'preserves original order of non-priority items',
        input: ['atd-unmuted', 'atd-active', 'self'],
        expected: ['self', 'atd-unmuted', 'atd-active'],
      },
      {
        description: 'returns items unchanged when no priority items present',
        input: ['atd-active', 'atd-unmuted'],
        expected: ['atd-active', 'atd-unmuted'],
      },
      {
        description: 'reorders when only priority items present',
        input: ['self', 'main'],
        expected: ['main', 'self'],
      },
      {
        description: 'handles empty list',
        input: [],
        expected: [],
      },
      {
        description: 'handles only some priority items present',
        input: ['atd-active', 'main'],
        expected: ['main', 'atd-active'],
      },
      {
        description: 'handles single non-priority item',
        input: ['atd-active'],
        expected: ['atd-active'],
      },
      {
        description: 'handles single priority item',
        input: ['self'],
        expected: ['self'],
      },
    ].forEach(({description, input, expected}) => {
      it(description, () => {
        const items = input.map((name) => ({name}));

        const result = sortByInitPriority(items, DATA_SET_INIT_PRIORITY);

        assert.deepEqual(
          result.map((i) => i.name),
          expected
        );
      });
    });

    it('should not mutate the original array', () => {
      const items = [{name: DataSetNames.ATD_ACTIVE}, {name: DataSetNames.SELF}];
      const originalOrder = items.map((i) => i.name);

      sortByInitPriority(items, DATA_SET_INIT_PRIORITY);

      assert.deepEqual(
        items.map((i) => i.name),
        originalOrder
      );
    });

    it('should preserve extra properties on items', () => {
      const items = [
        {name: DataSetNames.ATD_ACTIVE, url: 'url1'},
        {name: DataSetNames.SELF, url: 'url2'},
      ];

      const result = sortByInitPriority(items, DATA_SET_INIT_PRIORITY);

      assert.deepEqual(result, [
        {name: DataSetNames.SELF, url: 'url2'},
        {name: DataSetNames.ATD_ACTIVE, url: 'url1'},
      ]);
    });
  });
});
