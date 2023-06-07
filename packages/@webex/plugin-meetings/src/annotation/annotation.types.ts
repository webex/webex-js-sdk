/**
 * Type for an StrokeData Object
 */
type StrokeData = {
  fromUserId: string;
  fromDeviceUrl: string;
  toUserId: string;
  content: string;
  shareInstanceId: string;
  encryptionKeyUrl: string;
  version: string;
};

type RequestData = {
  toUserId: string;
  toDeviceUrl: string;
  shareInstanceId: string;
};

type CommandRequestBody = {
  actionType: string;
  resourceType: string;
  shareInstanceId: string;
  receivers?: any[];
};

interface IAnnotationChannel {
  // === below is for presenter
  acceptRequest: (approval) => undefined | Promise<void>;
  declineRequest: (approval) => undefined | Promise<void>;
  closeAnnotation: (requestData: RequestData) => undefined | Promise<void>;
  changeAnnotationOptions: (options, meeting) => undefined | Promise<void>;
  // === below is for attendee
  approveAnnotation: (requestData: RequestData) => undefined | Promise<void>;
  cancelApproveAnnotation: (requestData: RequestData, approval) => undefined | Promise<void>;
  sendStrokeData: (strokeData: StrokeData) => void;
  // =====
  approvalUrlUpdate: (approvalUrl: string) => void;
  locusUrlUpdate: (locusUrl: string) => void;
}

export type {StrokeData, RequestData, CommandRequestBody, IAnnotationChannel};
