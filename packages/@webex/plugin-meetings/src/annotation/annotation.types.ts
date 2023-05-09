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
  acceptRequest(approval);
  declineRequest(approval);
  approveAnnotation: (requestData: RequestData) => undefined | Promise<void>;
  cancelApproveAnnotation: (requestData: RequestData) => undefined | Promise<void>;
  closeAnnotation: (requestData: RequestData) => undefined | Promise<void>;
  sendStrokeData: (strokeData: StrokeData) => void;
  approvalUrlUpdate: (approvalUrl: string) => void;
  locusUrlUpdate: (locusUrl: string) => void;
}

export type {StrokeData, RequestData, CommandRequestBody, IAnnotationChannel};
