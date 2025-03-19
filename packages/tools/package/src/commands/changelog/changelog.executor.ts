import { Executor } from '@webex/cli-tools';

/**
 * Function to get all commits since a previous commit
 * @param scriptPath - Path to the script which we want to run.
 * @returns - Promise that resolves once the script is run and returns the output.
 */
export async function getCommits(prevCommit: string) {
  const result = (await Executor.execute(
    `git log --pretty=format:'escape"%Hescape":escape"%sescape",' ${prevCommit}..HEAD`,
  )) as string;

  // First, replace all `"` with `\"` ensuring we dont replace any `escape"`
  let sanitizedResult = result.replace(/(?<!\\)(?<!escape)"/g, '\\"');

  // Then, replace `escape"` with `"`
  sanitizedResult = sanitizedResult.replace(/escape"/g, '"');

  return `{${sanitizedResult
    .trim()
    .replace(/,\s*$/, '')
    .replace(/"([^"]+)":/g, '"$1":')}}`;
}
