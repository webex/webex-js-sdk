import { Package } from '../../models';
import { getCommits } from './changelog.executor';
import { AlongWithData, ChangelogEntry } from './changelog.types';

const fs = require('fs');

/**
 * Function to get the along with data
 * alongWithData object shows the versions of packages that were created with the current package
 * @param packageName - Name of the package for which we need to create the along with object.
 * @param packages - Details of all the modified packages.
 * @returns - AlongWithData for the package.
 */
function getAlongWithData(packageName: string, packages: Package[]): AlongWithData {
  const alongWith: { [key: string]: string } = {};
  Object.keys(packages).forEach((index: any) => {
    const pkg = packages[index].name;
    if (pkg !== packageName) {
      const exactVersion = packages[index].version;
      alongWith[pkg] = exactVersion;
    }
  });
  return alongWith;
}

/**
 * Function to create or update changelog files
 * @param packages - Details of the modified packages
 * @param prevCommitId - commitId of the previous commit
 */
export async function createOrUpdateChangelog(packages: Package[], prevCommitId: string) {
  Object.keys(packages).forEach(async (index: any) => {
    const pkgName = packages[index].name;
    const { version } = packages[index];
    const fileName = version.split('-')[0].replace(/\./g, '_');
    const mainFilePath = './docs/changelog/logs/main.json';

    // Constructing the changelog file name
    const changelogFilePath = `./docs/changelog/logs/v${fileName}.json`;

    // Prepare the changelog entry
    const changelogEntry: ChangelogEntry = {};
    let commits: string | unknown;
    try {
      commits = await getCommits(
        prevCommitId,
      );
    } catch (err) {
      console.log('Changelog Error: Error while getting commits', err);
      return;
    }

    // Create the changelog entry
    if (version && commits) {
      changelogEntry[pkgName] = {
        [version]: {
          published_date: Math.floor(Date.now()),
          commits: JSON.parse(commits as string),
          alongWith: getAlongWithData(pkgName, packages),
        },
      };
    }

    // Read existing changelog file or create a new one if it doesn't exist
    let changelogData: ChangelogEntry = {};
    if (fs.existsSync(changelogFilePath)) {
      const fileData = fs.readFileSync(changelogFilePath);
      changelogData = JSON.parse(fileData);
    }

    // Merge the new changelog entry
    if (changelogData[pkgName]) {
      changelogData[pkgName] = { ...changelogData[pkgName], ...changelogEntry[pkgName] };
    } else {
      changelogData = { ...changelogData, ...changelogEntry };
    }

    // Write the updated changelog data back to the file
    fs.writeFileSync(changelogFilePath, JSON.stringify(changelogData, null, 2));

    // Update main.json with the new version entry
    let mainData: Record<string, string> = {};
    if (fs.existsSync(mainFilePath)) {
      const mainFileData = fs.readFileSync(mainFilePath);
      mainData = JSON.parse(mainFileData);
    }

    // Add or update the version entry in main.json
    const versionKey = version.split('-')[0];
    mainData[versionKey] = `logs/v${fileName}.json`;

    // Write the updated main.json data back to the file
    fs.writeFileSync(mainFilePath, JSON.stringify(mainData, null, 2));
  });
}
