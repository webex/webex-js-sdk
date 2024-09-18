/**
 * Represents a generic API response.
 *
 * @public
 */
export interface ApiResponse<T> {
  /**
   * The response data.
   */
  data: T;

  /**
   * The response status code.
   */
  status: number;
}

/**
 * Interface representing an HTTP client.
 */
export interface HttpClient {
  /**
   * Make a GET request to the specified endpoint.
   * @param {string} endpoint - The endpoint to send the GET request to.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  get<T>(endpoint: string): Promise<ApiResponse<T>>;

  /**
   * Make a DELETE request to the specified endpoint.
   * @param {string} endpoint - The endpoint to send the DELETE request to.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  delete<T>(endpoint: string): Promise<ApiResponse<T>>;

  /**
   * Make a POST request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the POST request to.
   * @param {Record<string, any>} body - The body of the POST request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  post<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;

  /**
   * Make a PUT request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the PUT request to.
   * @param {Record<string, any>} body - The body of the PUT request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  put<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;

  /**
   * Make a PATCH request to the specified endpoint with the given body.
   * @param {string} endpoint - The endpoint to send the PATCH request to.
   * @param {Record<string, any>} body - The body of the PATCH request.
   * @returns {Promise<ApiResponse<T>>} - A promise that resolves to the response data.
   */
  patch<T>(endpoint: string, body: Record<string, any>): Promise<ApiResponse<T>>;
}
