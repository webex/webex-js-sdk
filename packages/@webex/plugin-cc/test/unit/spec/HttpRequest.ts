import HttpRequest from '../../../src/HttpRequest';
import {HTTP_METHODS, WebexSDK} from '../../../src/types';

describe('HttpRequest', () => {
    let webex: WebexSDK;
    let httpRequest: HttpRequest;

    beforeEach(() => {
        webex = {
            request: jest.fn(),
        } as unknown as WebexSDK;
        httpRequest = new HttpRequest(webex);
    });

    describe('request', () => {
        const URL = 'https://api.example.com/accessResource';
        const body = {id: '123', name: 'test'};

        it('should make a GET request successfully', async () => {
            const mockResponse = {data: 'response data'};
            (webex.request as jest.Mock).mockResolvedValue(mockResponse);

            const response = await httpRequest.request(URL, HTTP_METHODS.GET);

            expect(webex.request).toHaveBeenCalledWith({
                method: HTTP_METHODS.GET,
                uri: URL,
            });
            expect(response).toEqual(mockResponse);
        });

        it('should make a POST request successfully', async () => {
            const mockResponse = {data: 'response data'};
            (webex.request as jest.Mock).mockResolvedValue(mockResponse);

            const response = await httpRequest.request(URL, HTTP_METHODS.POST, body);

            expect(webex.request).toHaveBeenCalledWith({
                method: HTTP_METHODS.POST,
                uri: URL,
                body,
            });
            expect(response).toEqual(mockResponse);
        });

        it('should throw an error if the request fails', async () => {
            const mockError = new Error('Request failed');
            (webex.request as jest.Mock).mockRejectedValue(mockError);

            await expect(httpRequest.request(URL, HTTP_METHODS.GET)).rejects.toThrow(
                `Error while making request: ${mockError}`
            );
        });

        it('should throw an error for unsupported HTTP methods', async () => {
            const unsupportedMethod = 'PUT';

            await expect(httpRequest.request(URL, unsupportedMethod)).rejects.toThrow(
                `Error while making request: Error: Unsupported HTTP method: ${unsupportedMethod}`
            );
        });
    });
});