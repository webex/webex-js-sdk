import {getWorkerURL} from './webWorkerUtils';

describe('getWorkerURL', () => {
  it('should return the correct full URL from relative path', () => {
    const result = getWorkerURL('./worker.js');

    expect(result.href).toBe('https://example.com/some/path/worker.js');
  });
});
