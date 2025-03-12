/*
    Util file for extracting worker URL
*/
export function getWorkerURL(relativePath: string): URL {
  return new URL(relativePath, import.meta.url);
}
