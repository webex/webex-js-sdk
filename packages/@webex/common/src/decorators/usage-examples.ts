/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {plainToClass, classToPlain} from 'class-transformer';
import {validate} from 'class-validator';
import {
  WebexCacheable,
  WebexValidate,
  WebexRetry,
  WebexTimeout,
  WebexLoadingState,
  WebexConfigurable,
  WebexRequest,
  WebexResponse,
} from './modern-decorators';

/**
 * Example usage of modern Webex decorators vs legacy patterns
 */

// ==============================================================================
// BEFORE: Legacy Pattern (Old Way)
// ==============================================================================
/*
class LegacyWebexService {
  @oneFlight
  async fetchData(id: string) {
    // Manual caching, validation, retry logic
    return await this.apiCall(id);
  }
}
*/

// ==============================================================================
// AFTER: Modern Class-Transformer Pattern (New Way)
// ==============================================================================

export class ModernWebexService extends WebexConfigurable {
  // Loading state properties
  isLoading = false;
  isSaving = false;

  /**
   * Example: Cacheable method with 30-second TTL
   * Replaces the old @oneFlight decorator
   * @param userId - The user ID to fetch data for
   * @returns Promise with user data
   */
  @WebexCacheable({ttl: 30000, key: 'user-data'})
  @WebexValidate()
  async fetchUserData(userId: string): Promise<any> {
    console.log(`Fetching user data for: ${userId}`);
    // Simulate API call

    return new Promise((resolve) => {
      setTimeout(() => resolve({id: userId, name: 'John Doe'}), 100);
    });
  }

  /**
   * Example: Loading state management
   * Replaces the old @whileInFlight decorator
   * @param data - Data to save
   * @returns Promise with save result
   */
  @WebexLoadingState('isSaving')
  @WebexValidate()
  async saveData(data: any): Promise<{success: boolean}> {
    console.log('Saving data...');
    // Simulate save operation

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.3) {
          resolve({success: true});
        } else {
          reject(new Error('Save failed'));
        }
      }, 1500);
    });
  }

  /**
   * Example: Network operation with retry and timeout
   */
  @WebexRetry(3, 1000) // 3 attempts, 1 second delay
  @WebexTimeout(5000) // 5 second timeout
  @WebexValidate()
  async makeNetworkCall(endpoint: string): Promise<WebexResponse> {
    console.log(`Making network call to: ${endpoint}`);

    // Create a typed request object
    const request = plainToClass(WebexRequest, {
      method: 'get', // Will be transformed to uppercase
      url: endpoint,
      headers: {'Content-Type': 'application/json'},
    });

    // Simulate network call that might fail
    if (Math.random() < 0.7) {
      throw new Error('Network error');
    }

    // Return typed response
    return plainToClass(WebexResponse, {
      statusCode: 200,
      headers: {'Content-Type': 'application/json'},
      body: {success: true},
    });
  }

  /**
   * Example: Validation with class-validator decorators
   */
  @WebexValidate()
  async processValidatedData(data: any): Promise<string> {
    // Validation happens automatically due to @WebexValidate
    return `Processed: ${JSON.stringify(data)}`;
  }
}

// ==============================================================================
// USAGE EXAMPLES
// ==============================================================================

export async function demonstrateModernDecorators() {
  const service = new ModernWebexService();

  // Set some configurable properties (they'll be validated and transformed)
  service.namespace = 'WEBEX-SERVICE'; // Will be lowercased due to @Transform
  service.config = {debug: true, retries: 3};

  console.log('=== Modern Webex Decorators Demo ===\n');

  // 1. Caching Example
  console.log('1. Testing @WebexCacheable:');
  const start1 = Date.now();
  const result1 = await service.fetchUserData('user123');
  console.log(`First call took: ${Date.now() - start1}ms`);
  console.log('Result:', result1);

  const start2 = Date.now();
  const result2 = await service.fetchUserData('user123'); // Should be cached
  console.log(`Second call took: ${Date.now() - start2}ms (cached)`);
  console.log('Result:', result2);
  console.log();

  // 2. Retry + Timeout Example
  console.log('2. Testing @WebexRetry + @WebexTimeout:');
  try {
    const response = await service.makeNetworkCall('https://api.webex.com/users');
    console.log('Success! Status:', response.statusCode);
    console.log('Is successful response:', response.isSuccess);
  } catch (error) {
    console.log('Failed after retries:', error.message);
  }
  console.log();

  // 3. Class Transformation Example
  console.log('3. Testing Class Transformation:');
  const requestData = {
    method: 'post',
    url: 'https://api.webex.com/messages',
    headers: {authorization: 'Bearer token'},
    shouldAttemptReauth: 'true', // Will be converted to boolean
  };

  const typedRequest = plainToClass(WebexRequest, requestData);
  console.log('Original data:', requestData);
  console.log('Transformed request:', typedRequest);
  console.log('Method transformed to:', typedRequest.method); // Should be 'POST'
  console.log('shouldAttemptReauth type:', typeof typedRequest.shouldAttemptReauth);
  console.log();

  // 4. Serialization Example
  console.log('4. Testing Serialization:');
  const plainObject = classToPlain(service);
  console.log('Service serialized (private fields excluded):', plainObject);
  console.log();

  // 5. Validation Example
  console.log('5. Testing Validation:');
  const errors = await validate(service);
  if (errors.length > 0) {
    console.log('Validation errors:', errors);
  } else {
    console.log('Service validation passed ✓');
  }
}

// ==============================================================================
// COMPARISON: Old vs New
// ==============================================================================

export const COMPARISON = {
  legacy: {
    description: 'Old Ampersand + Custom Decorators',
    problems: [
      'Manual cache management',
      'No type safety',
      'Custom validation logic',
      'Inconsistent patterns',
      'Hard to maintain',
    ],
    example: `
// Old way
@oneFlight
async fetchData(id) {
  // Manual validation
  if (!id) throw new Error('Invalid ID');
  
  // Manual serialization
  return {
    id: id,
    data: await this.api.get('/data/' + id)
  };
}`,
  },
  modern: {
    description: 'New Class-Transformer + Class-Validator',
    benefits: [
      'Automatic type transformations',
      'Declarative validation',
      'Industry-standard patterns',
      'Better TypeScript support',
      'Automatic serialization/deserialization',
    ],
    example: `
// New way
@WebexCacheable({ttl: 30000})
@WebexValidate()
async fetchData(@IsString() id: string): Promise<UserData> {
  const response = await this.api.get('/data/' + id);
  return plainToClass(UserData, response);
}`,
  },
};
