/*
    Util file for extracting worker URL so it can be easily mocked in jest tests
*/
export function getWorkerURL(relativePath: string): URL {
  return new URL(relativePath, import.meta.url);
}
