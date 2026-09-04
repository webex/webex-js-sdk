import type {RtdRequestOptions, RtdRequestRegistration} from './types';

/**
 * Coordinates an outbound HTTP request with the RTD event that completes it.
 *
 * The HTTP response is only an acknowledgement. The caller receives the result
 * when the matching RTD event is resolved by the RTD WebSocket owner.
 */
type PendingRtdRequest<T> = {
  requestToken: symbol;
  ownerId?: string;
  correlationId: string;
  eventType: string;
  timeoutId?: ReturnType<typeof setTimeout>;
  createCancellationError: () => Error;
  resolve: (payload: T) => void;
  reject: (error: Error) => void;
};

class RtdRequestResolver {
  private pendingRequests = new Map<string, PendingRtdRequest<unknown>>();

  private static getRequestKey(eventType: string, correlationId: string): string {
    return JSON.stringify([eventType, correlationId]);
  }

  private removeRequest<T>(
    eventType: string,
    correlationId: string,
    settle?: (request: PendingRtdRequest<T>) => void
  ): PendingRtdRequest<T> | undefined {
    const key = RtdRequestResolver.getRequestKey(eventType, correlationId);
    const request = this.pendingRequests.get(key) as PendingRtdRequest<T> | undefined;

    if (!request) {
      return undefined;
    }

    if (request.timeoutId) {
      clearTimeout(request.timeoutId);
    }

    settle?.(request);
    this.pendingRequests.delete(key);

    return request;
  }

  public register<T>(options: RtdRequestOptions): RtdRequestRegistration<T> {
    const key = RtdRequestResolver.getRequestKey(options.eventType, options.correlationId);

    if (this.pendingRequests.has(key)) {
      throw options.createDuplicateRequestError();
    }

    let resolveResult: (payload: T) => void = () => undefined;
    let rejectResult: (error: Error) => void = () => undefined;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const request: PendingRtdRequest<T> = {
      requestToken: Symbol('rtd-request'),
      ownerId: options.ownerId,
      correlationId: options.correlationId,
      eventType: options.eventType,
      createCancellationError: options.createCancellationError,
      resolve: resolveResult,
      reject: rejectResult,
    };

    request.timeoutId = setTimeout(() => {
      this.removeRequest<T>(options.eventType, options.correlationId, (currentRequest) => {
        currentRequest.reject(options.createTimeoutError());
      });
    }, options.timeoutMs);
    this.pendingRequests.set(key, request as PendingRtdRequest<unknown>);

    return {requestToken: request.requestToken, result};
  }

  /**
   * Sends an HTTP request after registering its RTD response slot and resolves
   * with the matching RTD payload.
   */
  public async request<T>(options: RtdRequestOptions): Promise<T> {
    const registration = this.register<T>(options);
    const acknowledgement = Promise.resolve()
      .then(options.sendRequest)
      .catch((error) => {
        this.cancel(options.eventType, options.correlationId, registration.requestToken);
        throw error;
      });

    const [result] = await Promise.all([registration.result, acknowledgement]);

    return result;
  }

  /** Resolve a pending request from a parsed RTD event. */
  public resolve<T>(
    eventType: string,
    correlationId: string,
    payload: T
  ): 'resolved' | 'not-found' {
    const request = this.removeRequest<T>(eventType, correlationId, (currentRequest) => {
      currentRequest.resolve(payload);
    });

    return request ? 'resolved' : 'not-found';
  }

  /** Cancel a specific request without changing the original transport error. */
  public cancel(eventType: string, correlationId: string, requestToken: symbol): void {
    const key = RtdRequestResolver.getRequestKey(eventType, correlationId);
    const request = this.pendingRequests.get(key);

    if (!request || request.requestToken !== requestToken) {
      return;
    }

    this.removeRequest(eventType, correlationId);
  }

  /** Clear requests owned by a task or interaction. */
  public clear(ownerId: string, correlationId?: string): void {
    Array.from(this.pendingRequests.values()).forEach((request) => {
      if (
        request.ownerId === ownerId &&
        (correlationId === undefined || request.correlationId === correlationId)
      ) {
        this.removeRequest(request.eventType, request.correlationId, (currentRequest) => {
          currentRequest.reject(currentRequest.createCancellationError());
        });
      }
    });
  }

  /** Clear every pending request when the RTD lifecycle ends. */
  public clearAll(): void {
    Array.from(this.pendingRequests.values()).forEach((request) => {
      this.removeRequest(request.eventType, request.correlationId, (currentRequest) => {
        currentRequest.reject(currentRequest.createCancellationError());
      });
    });
  }
}

export default RtdRequestResolver;
