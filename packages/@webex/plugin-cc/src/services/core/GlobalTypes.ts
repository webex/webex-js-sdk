export type Msg<T = any> = {
  type: string;
  orgId: string;
  trackingId: string;
  data: T;
};

export type Failure = Msg<{
  agentId: string;
  trackingId: string;
  reasonCode: number;
  orgId: string;
  reason: string;
}>;
