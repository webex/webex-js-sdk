import {XXH3_128} from 'xxh3-ts';
import {EMPTY_HASH} from './constants';
import {ObjectType} from './types';

export type LeafDataItem = {
  type: ObjectType;
  id: number;
  version: number;
};

/**
 * HashTree is a data structure that organizes items into leaves based on their IDs,
 */
class HashTree {
  leaves: Array<Record<string, Record<number, LeafDataItem>>>;

  leafHashes: Array<string>;
  readonly numLeaves: number;

  /**
   * Constructs a new HashTree.
   * @param {LeafDataItem[]} leafData Initial data to populate the tree.
   * @param {number} numLeaves The number of leaf nodes in the tree. Must be 0 or a power of 2.
   * @throws {Error} If numLeaves is not 0 or a power of 2.
   */
  constructor(leafData: LeafDataItem[], numLeaves: number) {
    // eslint-disable-next-line no-bitwise
    if ((numLeaves & (numLeaves - 1)) !== 0) {
      throw new Error(`Number of leaves must be a power of 2, saw ${numLeaves}`);
    }

    this.numLeaves = numLeaves;
    this.leafHashes = new Array(numLeaves).fill(EMPTY_HASH);

    this.leaves = new Array(numLeaves).fill(null).map(() => {
      return {};
    });

    if (leafData) {
      this.putItems(leafData);
    }
  }

  /**
   * Internal logic for adding or updating an item, without computing the leaf hash.
   * @param {LeafDataItem} item The item to add or update.
   * @returns {{put: boolean, index: (number|null)}} Object indicating if put and the leaf index.
   * @private
   */
  private _putItemInternal(item: LeafDataItem): {put: boolean; index: number | null} {
    if (this.numLeaves === 0) {
      return {put: false, index: null}; // Cannot add to a tree with 0 leaves
    }

    const index = item.id % this.numLeaves;

    if (!this.leaves[index][item.type]) {
      this.leaves[index][item.type] = {};
    }

    const existingItem = this.leaves[index][item.type][item.id];

    if (!existingItem || existingItem.version < item.version) {
      this.leaves[index][item.type][item.id] = item;

      return {put: true, index};
    }

    return {put: false, index: null};
  }

  /**
   * Adds or updates a single item in the hash tree.
   * @param {LeafDataItem} item The item to add or update.
   * @returns {boolean} True if the item was added or updated, false otherwise (e.g., older version or tree has 0 leaves).
   */
  putItem(item: LeafDataItem): boolean {
    const {put, index} = this._putItemInternal(item);

    if (put && index !== null) {
      this.computeLeafHash(index);
    }

    return put;
  }

  /**
   * Adds or updates multiple items in the hash tree.
   * @param {LeafDataItem[]} items The array of items to add or update.
   * @returns {boolean[]} An array of booleans indicating success for each item.
   */
  putItems(items: LeafDataItem[]): boolean[] {
    if (this.numLeaves === 0 && items.length > 0) {
      // Cannot add items to a tree with 0 leaves.
      return items.map(() => false);
    }
    const results: boolean[] = [];
    const changedLeafIndexes = new Set<number>();

    items.forEach((item) => {
      const {put, index} = this._putItemInternal(item);
      results.push(put);
      if (put && index !== null) {
        changedLeafIndexes.add(index);
      }
    });

    changedLeafIndexes.forEach((index) => {
      this.computeLeafHash(index);
    });

    return results;
  }

  /**
   * Internal logic for removing an item, without computing the leaf hash.
   * @param {LeafDataItem} item The item to remove.
   * @returns {{removed: boolean, index: (number|null)}} Object indicating if removed and the leaf index.
   * @private
   */
  private _removeItemInternal(item: LeafDataItem): {removed: boolean; index: number | null} {
    if (this.numLeaves === 0) {
      return {removed: false, index: null};
    }

    const index = item.id % this.numLeaves;

    if (
      this.leaves[index] &&
      this.leaves[index][item.type] &&
      this.leaves[index][item.type][item.id]
    ) {
      const existingItem = this.leaves[index][item.type][item.id];
      if (
        existingItem.id === item.id &&
        existingItem.type === item.type &&
        existingItem.version <= item.version
      ) {
        delete this.leaves[index][item.type][item.id];
        if (Object.keys(this.leaves[index][item.type]).length === 0) {
          delete this.leaves[index][item.type];
        }

        return {removed: true, index};
      }
    }

    return {removed: false, index: null};
  }

  /**
   * Removes a single item from the hash tree.
   * The removal is based on matching type, id, and the provided item's version
   * being greater than or equal to the existing item's version.
   * @param {LeafDataItem} item The item to remove.
   * @returns {boolean} True if the item was removed, false otherwise.
   */
  removeItem(item: LeafDataItem): boolean {
    const {removed, index} = this._removeItemInternal(item);

    if (removed && index !== null) {
      this.computeLeafHash(index);
    }

    return removed;
  }

  /**
   * Removes multiple items from the hash tree.
   * @param {LeafDataItem[]} items The array of items to remove.
   * @returns {boolean[]} An array of booleans indicating success for each item.
   */
  removeItems(items: LeafDataItem[]): boolean[] {
    if (this.numLeaves === 0 && items.length > 0) {
      return items.map(() => false);
    }

    const results: boolean[] = [];
    const changedLeafIndexes = new Set<number>();

    items.forEach((item) => {
      const {removed, index} = this._removeItemInternal(item);
      results.push(removed);
      if (removed && index !== null) {
        changedLeafIndexes.add(index);
      }
    });

    changedLeafIndexes.forEach((index) => {
      this.computeLeafHash(index);
    });

    return results;
  }

  /**
   * Updates multiple items in the hash tree.
   * This method can handle both updating and removing items based on the `operation` flag.
   *
   * @param {object[]} itemUpdates An array of objects containing `operation` flag and the `item` to update.
   * @returns {boolean[]} An array of booleans indicating success for each operation.
   */
  updateItems(itemUpdates: {operation: 'update' | 'remove'; item: LeafDataItem}[]): boolean[] {
    if (this.numLeaves === 0 && itemUpdates.length > 0) {
      return itemUpdates.map(() => false);
    }

    const results: boolean[] = [];
    const changedLeafIndexes = new Set<number>();

    itemUpdates.forEach(({operation, item}) => {
      if (operation === 'remove') {
        const {removed, index} = this._removeItemInternal(item);
        results.push(removed);
        if (removed && index !== null) {
          changedLeafIndexes.add(index);
        }
      } else {
        const {put, index} = this._putItemInternal(item);
        results.push(put);
        if (put && index !== null) {
          changedLeafIndexes.add(index);
        }
      }
    });

    changedLeafIndexes.forEach((index) => {
      this.computeLeafHash(index);
    });

    return results;
  }

  /**
   * Computes the hash for a specific leaf.
   * The hash is based on the sorted items within the leaf.
   * @param {number} index The index of the leaf to compute the hash for.
   * @returns {void}
   */
  computeLeafHash(index: number) {
    if (index < 0 || index >= this.numLeaves) {
      // nothing to do
      return;
    }
    const leafContent = this.leaves[index];

    const totalItemsCount = Object.keys(leafContent).reduce((count, type) => {
      return count + Object.keys(leafContent[type]).length;
    }, 0);
    const buffer = Buffer.alloc(totalItemsCount * 16);

    let offset = 0;

    // iterate through the item types lexicographically
    const itemTypes = Object.keys(leafContent).sort();
    itemTypes.forEach((type) => {
      // iterate through the items of this type in ascending order of ID
      const items = Object.values(leafContent[type]).sort(
        (a: LeafDataItem, b: LeafDataItem) => a.id - b.id
      );

      // add all the items id and version to the hasher
      items.forEach((item: LeafDataItem) => {
        buffer.writeBigInt64LE(BigInt(item.id), offset);
        buffer.writeBigInt64LE(BigInt(item.version), offset + 8);

        offset += 16;
      });
    });

    this.leafHashes[index] = XXH3_128(buffer, BigInt(0)).toString(16).padStart(32, '0');
  }

  /**
   * Computes all internal and leaf node hashes of the tree.
   * Internal node hashes are computed bottom-up from the leaf hashes.
   * @returns {string[]} An array of hash strings, with internal node hashes first, followed by leaf hashes.
   * Returns `[EMPTY_HASH]` if the tree has 0 leaves.
   */
  computeTreeHashes(): string[] {
    if (this.numLeaves === 0) {
      return [EMPTY_HASH];
    }

    let currentLevelHashes = [...this.leafHashes];
    const allHashes = [];

    while (currentLevelHashes.length > 1) {
      const nextLevelHashes: string[] = [];
      for (let i = 0; i < currentLevelHashes.length; i += 2) {
        const leftHash = currentLevelHashes[i];
        const rightHash = i + 1 < currentLevelHashes.length ? currentLevelHashes[i + 1] : leftHash;

        const input = Buffer.concat([
          Buffer.from(leftHash, 'hex').subarray(0, 8).reverse(),
          Buffer.from(leftHash, 'hex').subarray(8, 16).reverse(),
          Buffer.from(rightHash, 'hex').subarray(0, 8).reverse(),
          Buffer.from(rightHash, 'hex').subarray(8, 16).reverse(),
        ]);

        nextLevelHashes.push(XXH3_128(input, BigInt(0)).toString(16).padStart(32, '0'));
      }
      currentLevelHashes = nextLevelHashes;
      allHashes.unshift(...currentLevelHashes);
    }

    return [...allHashes, ...this.leafHashes];
  }

  /**
   * Returns all hashes in the tree (internal nodes then leaf nodes).
   * @returns {string[]} An array of hash strings.
   */
  getHashes(): string[] {
    return this.computeTreeHashes();
  }

  /**
   * Computes and returns the hash value of the root node.
   * @returns {string} The root hash of the entire tree. Returns `EMPTY_HASH` if the tree has 0 leaves.
   */
  getRootHash(): string {
    if (this.numLeaves === 0) {
      return EMPTY_HASH;
    }

    return this.computeTreeHashes()[0];
  }

  /**
   * Gets the number of leaves in the tree.
   * @returns {number} The number of leaves.
   */
  getLeafCount(): number {
    return this.numLeaves;
  }

  /**
   * Calculates the total number of items stored in the tree.
   * @returns {number} The total number of items.
   */
  getTotalItemCount(): number {
    let count = 0;
    for (const leaf of this.leaves) {
      for (const type of Object.keys(leaf)) {
        count += Object.keys(leaf[type]).length;
      }
    }

    return count;
  }

  /**
   * Retrieves all data items from a specific leaf.
   * @param {number} leafIndex The index of the leaf.
   * @returns {LeafDataItem[]} An array of LeafDataItem in the specified leaf, sorted by ID,
   * or an empty array if the index is invalid or leaf is empty.
   */
  getLeafData(leafIndex: number): LeafDataItem[] {
    if (leafIndex < 0 || leafIndex >= this.numLeaves) {
      return [];
    }
    const leafContent = this.leaves[leafIndex];
    const items: LeafDataItem[] = [];
    for (const type of Object.keys(leafContent)) {
      items.push(...Object.values(leafContent[type]));
    }
    // Optionally sort them if a specific order is required, e.g., by ID
    items.sort((a, b) => a.id - b.id);

    return items;
  }

  /**
   * Resizes the HashTree to have a new number of leaf nodes, redistributing all existing items.
   * @param {number} newNumLeaves The new number of leaf nodes (must be 0 or a power of 2).
   * @returns {boolean} true if the tree was resized, false if the size didn't change.
   * @throws {Error} if newNumLeaves is not 0 or a power of 2.
   */
  resize(newNumLeaves: number): boolean {
    // eslint-disable-next-line no-bitwise
    if (newNumLeaves < 0 || (newNumLeaves !== 0 && (newNumLeaves & (newNumLeaves - 1)) !== 0)) {
      throw new Error('New number of leaves must be 0 or a power of 2');
    }

    if (newNumLeaves === this.numLeaves) {
      return false;
    }

    const allItems: LeafDataItem[] = [];
    for (const leaf of this.leaves) {
      for (const type of Object.keys(leaf)) {
        allItems.push(...Object.values(leaf[type]));
      }
    }

    // Re-initialize
    // eslint-disable-next-line no-extra-semi
    (this as any).numLeaves = newNumLeaves; // Type assertion to update readonly property
    this.leafHashes = new Array(newNumLeaves).fill(EMPTY_HASH);
    this.leaves = new Array(newNumLeaves).fill(null).map(() => ({}));

    if (newNumLeaves > 0) {
      this.putItems(allItems); // Re-add items which will be re-assigned to leaves and re-hashed
    }

    return true;
  }

  /**
   * Compares the tree's leaf hashes with an external set of hashes and returns the indices of differing leaf nodes.
   * The externalHashes array is expected to contain all node hashes (internal followed by leaves),
   * similar to the output of getHashes().
   * @param {string[]} externalHashes An array of hash strings (internal node hashes then leaf hashes).
   * @returns {number[]} An array of indices of the leaf nodes that have different hashes.
   */
  diffHashes(externalHashes: string[]): number[] {
    if (this.numLeaves === 0) {
      // If this tree is empty, its hash is EMPTY_HASH.
      // It differs if externalHashes is not a single EMPTY_HASH.
      if (externalHashes && externalHashes.length === 1 && externalHashes[0] === EMPTY_HASH) {
        return []; // No differences
      }
      // An empty tree has no leaves to differ, so return an empty array
      // as no specific leaf indexes are different.

      return [];
    }

    // We are interested in comparing the leaf hashes part.
    // The externalHashes array should also have its leaf hashes at the end.
    const differingLeafIndexes: number[] = [];
    // Calculate where the leaf hashes would start in the externalHashes array,
    // assuming it has the same number of leaves as this tree.
    const externalLeafHashesStart = externalHashes.length - this.numLeaves;

    if (externalLeafHashesStart < 0) {
      // externalHashes is too short to contain a complete set of leaf hashes
      // corresponding to this tree's numLeaves.
      // In this case, consider all of this tree's leaves as "different".
      for (let i = 0; i < this.numLeaves; i += 1) {
        differingLeafIndexes.push(i);
      }

      return differingLeafIndexes;
    }

    // Compare each leaf hash
    for (let i = 0; i < this.numLeaves; i += 1) {
      const ownLeafHash = this.leafHashes[i];
      // externalLeafHash might be undefined if externalHashes is shorter than expected
      // but externalLeafHashesStart was non-negative, implying a structural mismatch.
      const externalLeafHash = externalHashes[externalLeafHashesStart + i];
      if (ownLeafHash !== externalLeafHash) {
        differingLeafIndexes.push(i);
      }
    }

    return differingLeafIndexes;
  }
}

export default HashTree;
