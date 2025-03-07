import {getWorkerURL} from './webWorkerUtils';

describe('getWorkerURL', () => {
  it('should return a valid URL including the relative path', () => {
    const relativePath = './worker.js';
    const url = getWorkerURL(relativePath);
    expect(url).toBeInstanceOf(URL);
    expect(url.href).toContain('worker.js');
  });
});
