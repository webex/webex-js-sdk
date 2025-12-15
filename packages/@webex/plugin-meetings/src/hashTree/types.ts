import {Enum} from '../constants';

// todo: Locus docs have now more types like CONTROL_ENTRY, EMBEDDED_APP - need to add support for them once Locus implements them
export const ObjectType = {
  participant: 'participant',
  self: 'self',
  locus: 'locus',
  mediaShare: 'mediashare',
  info: 'info',
  fullState: 'fullstate',
  links: 'links',
} as const;

export type ObjectType = Enum<typeof ObjectType>;

// mapping from ObjectType to top level LocusDTO keys
export const ObjectTypeToLocusKeyMap = {
  [ObjectType.links]: 'links',
  [ObjectType.info]: 'info',
  [ObjectType.fullState]: 'fullState',
  [ObjectType.self]: 'self',
  [ObjectType.participant]: 'participants', // note: each object is a single participant in participants array
  [ObjectType.mediaShare]: 'mediaShares', // note: each object is a single mediaShare in mediaShares array
};
export interface HtMeta {
  elementId: {
    type: ObjectType;
    id: number;
    version: number;
  };
  dataSetNames: string[];
}
