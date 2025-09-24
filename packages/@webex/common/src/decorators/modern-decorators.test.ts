/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {plainToClass} from 'class-transformer';
import {validate} from 'class-validator';
import {
  WebexCacheable,
  WebexValidate,
  WebexRetry,
  WebexTimeout,
  WebexLoadingState,
} from './modern-decorators';
import {WebexConfigurable, WebexRequest, WebexResponse} from './transformable-classes.js';

describe('Modern Webex Decorators', () => {
  class TestService extends WebexConfigurable {
    isLoading = false;
    isSaving = false;
    callCount = 0;

    @WebexCacheable({ttl: 100})
    async cachedMethod(input: string): Promise<string> {
      this.callCount++;

      return `cached-${input}-${this.callCount}`;
    }

    @WebexLoadingState('isLoading')
    async loadingMethod(delay = 50): Promise<string> {
      return new Promise((resolve) => {
        setTimeout(() => resolve('loaded'), delay);
      });
    }

    @WebexRetry(2, 10)
    async retryMethod(shouldFail = true): Promise<string> {
      if (shouldFail) {
        throw new Error('Retry test error');
      }

      return 'success';
    }

    @WebexTimeout(50)
    async timeoutMethod(delay = 100): Promise<string> {
      return new Promise((resolve) => {
        setTimeout(() => resolve('completed'), delay);
      });
    }

    @WebexValidate()
    async validatedMethod(data: any): Promise<string> {
      return `validated: ${JSON.stringify(data)}`;
    }
  }

  let service: TestService;

  beforeEach(() => {
    service = new TestService();
    service.callCount = 0;
  });

  describe('@WebexCacheable', () => {
    it('should cache method results', async () => {
      const result1 = await service.cachedMethod('test');
      const result2 = await service.cachedMethod('test');

      expect(result1).toBe('cached-test-1');
      expect(result2).toBe('cached-test-1'); // Same result, from cache
      expect(service.callCount).toBe(1); // Method called only once
    });

    it('should use different cache keys for different arguments', async () => {
      const result1 = await service.cachedMethod('test1');
      const result2 = await service.cachedMethod('test2');

      expect(result1).toBe('cached-test1-1');
      expect(result2).toBe('cached-test2-2');
      expect(service.callCount).toBe(2);
    });

    it('should respect TTL and expire cache', async () => {
      const result1 = await service.cachedMethod('ttl-test');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const result2 = await service.cachedMethod('ttl-test');

      expect(result1).toBe('cached-ttl-test-1');
      expect(result2).toBe('cached-ttl-test-2'); // Cache expired, new call
      expect(service.callCount).toBe(2);
    });
  });

  describe('@WebexLoadingState', () => {
    it('should set loading state during async operation', async () => {
      expect(service.isLoading).toBe(false);

      const promise = service.loadingMethod(100);

      // Check loading state is set immediately
      expect(service.isLoading).toBe(true);

      const result = await promise;

      // Check loading state is cleared after completion
      expect(service.isLoading).toBe(false);
      expect(result).toBe('loaded');
    });

    it('should clear loading state on error', async () => {
      class ErrorService extends WebexConfigurable {
        isLoading = false;

        @WebexLoadingState('isLoading')
        async errorMethod(): Promise<void> {
          throw new Error('Test error');
        }
      }

      const errorService = new ErrorService();

      try {
        await errorService.errorMethod();
      } catch (error) {
        // Expected error
      }

      expect(errorService.isLoading).toBe(false);
    });
  });

  describe('@WebexRetry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;

      class RetryTestService extends WebexConfigurable {
        @WebexRetry(3, 10)
        async flakeyMethod(): Promise<string> {
          attempts++;
          if (attempts < 3) {
            throw new Error('Retry me');
          }

          return 'success after retries';
        }
      }

      const retryService = new RetryTestService();
      const result = await retryService.flakeyMethod();

      expect(result).toBe('success after retries');
      expect(attempts).toBe(3);
    });

    it('should throw error after max retries', async () => {
      await expect(service.retryMethod(true)).rejects.toThrow('Retry test error');
    });
  });

  describe('@WebexTimeout', () => {
    it('should timeout long-running operations', async () => {
      await expect(service.timeoutMethod(100)).rejects.toThrow('Operation timed out after 50ms');
    });

    it('should not timeout fast operations', async () => {
      const result = await service.timeoutMethod(10);
      expect(result).toBe('completed');
    });
  });

  describe('@WebexValidate', () => {
    it('should validate service instance before method execution', async () => {
      // Valid service should work
      const result = await service.validatedMethod({test: 'data'});
      expect(result).toBe('validated: {"test":"data"}');
    });
  });

  describe('WebexRequest', () => {
    it('should transform request data correctly', () => {
      const requestData = {
        method: 'post',
        url: 'https://api.webex.com/v1/messages',
        headers: {'content-type': 'application/json'},
        shouldAttemptReauth: 'true',
      };

      const request = plainToClass(WebexRequest, requestData) as WebexRequest;

      expect(request.method).toBe('POST'); // Transformed to uppercase
      expect(request.url).toBe('https://api.webex.com/v1/messages');
      expect(request.shouldAttemptReauth).toBe(true); // Transformed to boolean
      expect(typeof request.shouldAttemptReauth).toBe('boolean');
    });
  });

  describe('WebexResponse', () => {
    it('should create response objects with computed properties', () => {
      const responseData = {
        statusCode: 200,
        headers: {'content-type': 'application/json'},
        body: {message: 'success'},
      };

      const response = plainToClass(WebexResponse, responseData) as WebexResponse;

      expect(response.statusCode).toBe(200);
      expect(response.isSuccess).toBe(true); // Computed property
    });

    it('should correctly identify failed responses', () => {
      const responseData = {
        statusCode: 404,
        headers: {'content-type': 'application/json'},
        body: {error: 'Not found'},
      };

      const response = plainToClass(WebexResponse, responseData) as WebexResponse;

      expect(response.statusCode).toBe(404);
      expect(response.isSuccess).toBe(false); // Computed property
    });
  });

  describe('WebexConfigurable', () => {
    it('should transform namespace to lowercase', () => {
      const config = new WebexConfigurable();
      config.namespace = 'WEBEX-SERVICE';

      // Simulate class-transformer transformation
      const transformed = plainToClass(WebexConfigurable, {
        namespace: 'WEBEX-SERVICE',
        config: {debug: true},
      }) as WebexConfigurable;

      expect(transformed.namespace).toBe('webex-service');
    });

    it('should handle internal state correctly', () => {
      const config = new WebexConfigurable();

      config.setInternal('test-key', 'test-value');
      expect(config.getInternal('test-key')).toBe('test-value');
      expect(config.getInternal('non-existent')).toBeUndefined();
    });

    it('should validate correctly', async () => {
      const config = new WebexConfigurable();
      config.namespace = 'valid-namespace';

      const errors = await validate(config);
      expect(errors.length).toBe(0);
    });
  });
});
