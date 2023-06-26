export const EVENT_TRIGGERS = {
  ANNOTATION_STROKE_DATA: 'annotation:strokeData',
  ANNOTATION_COMMAND: 'annotation:command',
};
export const ANNOTATION_RESOURCE_TYPE = 'AnnotationOnShare';
export const ANNOTATION_RELAY_TYPES = {
  ANNOTATION_CLIENT: 'annotation.client',
};

export const ANNOTATION_STATUS = {
  NO_ANNOTATION: 'NO_ANNOTATION',
  RUNNING_ANNOTATION: 'RUNNING_ANNOTATION',
};

export enum ANNOTATION_POLICY {
  ANYONE_CAN_ANNOTATE = 'AnyoneCanAnnotate',
  APPROVAL = 'Approval',
  ANNOTATION_NOT_ALLOWED = 'AnnotationNotAllowed',
}

export const ANNOTATION_REQUEST_TYPE = {
  ANNOTATION_MESSAGE: 'annotation_message',
};

export const enum ANNOTATION_ACTION_TYPE {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  OFFERED = 'OFFERED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  CLOSED = 'CLOSED',
}

export const ANNOTATION = 'annotation';
