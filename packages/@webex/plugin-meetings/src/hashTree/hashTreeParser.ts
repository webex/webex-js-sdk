import HashTree from './hashTree';

/**
 * Parses hash tree eventing locus data
 */
class HashTreeParser {
  trees: Record<string, HashTree> = {};

  /**
   * Constructor for HashTreeParser
   * @param {Object} initialLocus - The initial locus data containing the hash tree information
   */
  constructor(initialLocus: any) {
    const {dataSets, locus} = initialLocus; // extract dataSets from initialLocus

    // object mapping dataset names to arrays of leaf data
    const leafData: Record<string, Array<{type: string; id: number; version: number}>> = {};

    // each dataset exists at a different place in the dto
    // iterate recursively over the locus and if it has a meta key,
    // create an object with the type, id and version and add it to the appropriate leafData array

    const findAndStoreMetaData = (currentLocusPart: any) => {
      if (typeof currentLocusPart !== 'object' || currentLocusPart === null) {
        return;
      }

      if (currentLocusPart.meta && currentLocusPart.meta.dataSets) {
        const {type, id, version, dataSets: metaDataSets} = currentLocusPart.meta;
        const leafInfo = {type, id, version};

        for (const dataSetName of metaDataSets) {
          if (!leafData[dataSetName]) {
            leafData[dataSetName] = [];
          }
          leafData[dataSetName].push(leafInfo);
        }
      }

      if (Array.isArray(currentLocusPart)) {
        for (const item of currentLocusPart) {
          findAndStoreMetaData(item);
        }
      } else {
        for (const key of Object.keys(currentLocusPart)) {
          if (Object.prototype.hasOwnProperty.call(currentLocusPart, key)) {
            findAndStoreMetaData(currentLocusPart[key]);
          }
        }
      }
    };

    findAndStoreMetaData(locus);

    for (const dataSet of dataSets) {
      const {name, leafCount} = dataSet;

      const hashTree = new HashTree(leafData[name] || [], leafCount);

      this.trees[name] = hashTree;
    }
  }
}

export default HashTreeParser;
