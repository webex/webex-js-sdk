import { execFile } from 'child_process';
import { promisify } from 'util';

const execute = promisify(execFile);

const DOCUMENTATION_PATHS = [
  ':(top,exclude,glob)**/*.md',
  ':(top,exclude,glob)**/*.mdx',
  ':(top,exclude,glob)**/ai-docs/**',
  ':(top,exclude,glob)**/docs/**',
  ':(top,exclude,glob)**/.sdd/**',
  ':(top,exclude,glob)**/.repo-context.json',
  ':(top,exclude,glob)**/schemas/repo-context.schema.json',
  ':(top,exclude,glob)documentation/**',
];

/**
 * Find the comparison commit when the change set can affect a package release.
 *
 * @param since - Git reference used to find changes.
 * @returns - The merge base, or undefined for documentation-only changes.
 */
const getReleaseRef = async (since: string): Promise<string | undefined> => {
  const { stdout: base } = await execute('git', ['merge-base', '--', since, 'HEAD']);
  const reference = base.trim();
  const { stdout: tracked } = await execute('git', [
    'diff', '--name-only', '--no-renames', '-z', reference, '--', ':/', ...DOCUMENTATION_PATHS,
  ]);

  if (tracked) {
    return reference;
  }

  const { stdout: untracked } = await execute('git', [
    'ls-files', '--others', '--exclude-standard', '-z', '--', ':/', ...DOCUMENTATION_PATHS,
  ]);

  return untracked ? reference : undefined;
};

export default getReleaseRef;
