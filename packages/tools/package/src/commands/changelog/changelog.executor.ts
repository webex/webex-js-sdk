import { Executor } from '@webex/cli-tools';

/**
 * Function to get all commits since a previous commit
 * @param scriptPath - Path to the script which we want to run.
 * @returns - Promise that resolves once the script is run and returns the output.
 */
export async function getCommits(prevCommit:string) {
  const result = await Executor.execute(`git log --pretty=format:'"%H":"%s",' ${prevCommit}..HEAD`) as string;
  // Remove trailing comma and wrap the input in curly braces
  // Replace all occurrences of ":" with "\":\"" and add quotes around keys
  return `{${result.trim().replace(/,\s*$/, '').replace(/"([^"]+)":/g, '"$1":')}}`;
}
