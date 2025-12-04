import {Enum} from '../constants';

// todo: Locus docs have now more types like CONTROL_ENTRY, EMBEDDED_APP, FULL_STATE, INFO, MEDIA_SHARE - need to add support for them once Locus implements them
export const ObjectType = {
  participant: 'participant',
  self: 'self',
  locus: 'locus',
  mediaShare: 'mediashare',
} as const;

export type ObjectType = Enum<typeof ObjectType>;

export interface HtMeta {
  elementId: {
    type: ObjectType;
    id: number;
    version: number;
  };
  dataSetNames: string[];
}
