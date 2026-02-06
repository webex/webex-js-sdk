/**
 * app.js - Pure business logic only. No DOM, no document/window, no event listeners.
 * Data in → data out. UI layer (compare.js) handles fetching, DOM, and rendering.
 */
export const github_base_url = "https://github.com/webex/webex-js-sdk/";

/* ============================================
   INDEX SEARCH - Pure business logic
   ============================================ */

function doSearch_commit(searchParams, drill_down) {
    let resulting_versions = new Set(),
        resulting_commit_messages = new Set(),
        resulting_commit_hash = new Set(),
        search_results = [];
    for(let pkgName in drill_down){
        const thisPackage = drill_down[pkgName];
        for(let version in thisPackage){
            const thisVersion = thisPackage[version];
            let allHashes = new Set(), discontinueSearch = false;
            for(let hash in thisVersion.commits){
                const thisCommit = thisVersion.commits[hash];
                if(discontinueSearch){
                    resulting_versions.add(`${pkgName}-${version}`);
                    resulting_commit_messages.add(thisCommit);
                    allHashes.forEach(h => resulting_commit_hash.add(h));
                }
                else{
                    allHashes.add(hash);
                    if(!resulting_versions.has(`${pkgName}-${version}`) && 
                        !resulting_commit_messages.has(thisCommit) &&
                        !resulting_commit_hash.has(hash)
                    ){
                        if(
                            (
                                searchParams.commitMessage && searchParams.commitMessage.trim() !== "" && 
                                thisCommit.includes(searchParams.commitMessage.trim())
                            ) ||
                            (
                                searchParams.commitHash && (hash.includes(searchParams.commitHash) || searchParams.commitHash.startsWith(hash))
                            )
                        ){
                            resulting_versions.add(`${pkgName}-${version}`);
                            resulting_commit_messages.add(thisCommit);
                            allHashes.forEach(h => resulting_commit_hash.add(h));
                            allHashes = new Set();
                            discontinueSearch = true;
                            search_results.push({
                                package: pkgName,
                                version,
                                published_date: thisVersion.published_date,
                                commits: thisVersion.commits,
                                alongWith: thisVersion.alongWith,
                            });
                        }
                    }
                }
            }
        }
    }
    return search_results;
}

/**
 * Pure: compute search results from changelog and search params (for index page).
 * @param {Object} currentChangelog - Changelog data
 * @param {Object} searchParams - { stable_version, package, version, commitMessage, commitHash }
 * @returns {{ search_results: Array, stable_version: string }}
 */
export function getSearchResults(currentChangelog, searchParams) {
    const { package: pkgName, version } = searchParams;
    let drill_down = currentChangelog ? { ...currentChangelog } : {};
    let shouldTransform = true;
    let search_results = [];

    if (pkgName !== null && pkgName?.trim() !== "") {
        drill_down = drill_down[pkgName] ? { [pkgName]: drill_down[pkgName] } : {};
    }
    if (version !== null && version?.trim() !== "") {
        drill_down = drill_down[pkgName]?.[version]
            ? { [pkgName]: { [version]: drill_down[pkgName][version] } }
            : {};
    } else if (
        (searchParams.commitMessage !== null && searchParams.commitMessage?.trim() !== "") ||
        (searchParams.commitHash !== null && searchParams.commitHash?.trim() !== "")
    ) {
        search_results = doSearch_commit(searchParams, drill_down);
        shouldTransform = false;
    }

    if (shouldTransform) {
        Object.keys(drill_down).forEach((pkg) => {
            Object.keys(drill_down[pkg]).forEach((ver) => {
                search_results.push({
                    package: pkg,
                    version: ver,
                    published_date: drill_down[pkg][ver].published_date,
                    commits: drill_down[pkg][ver].commits,
                    alongWith: drill_down[pkg][ver].alongWith,
                });
            });
        });
    }

    search_results.sort((a, b) => b.published_date - a.published_date);
    return { search_results, stable_version: searchParams.stable_version };
}

/**
 * Pure: validate version input for index search form.
 * @param {string} version - Version string
 * @param {string} stableVersion - Stable version (e.g. 'v3.4.0')
 * @returns {{ valid: boolean, errorMessage: string }}
 */
export function validateVersionInputResult(version, stableVersion) {
    const expectedPattern = new RegExp(`^${stableVersion}-([a-z\\-]*\\.)?\\d+$`, 'i');
    if (version !== "" && !expectedPattern.test(version) && stableVersion !== version) {
        return {
            valid: false,
            errorMessage: `Version can be empty or should start with ${stableVersion} and match ${stableVersion}-{tag}.patch_version. Eg: ${stableVersion}-next.1`
        };
    }
    return { valid: true, errorMessage: "" };
}

/**
 * Pure: package list for changelog (with 'separator' for dropdown dividers).
 * @param {Object} changelog - Changelog object
 * @returns {Array<string>} e.g. ['separator', 'webex', '@webex/calling', 'separator', ...]
 */
export function getPackageListForChangelog(changelog) {
    const specialPackages = ['webex', '@webex/calling'];
    const filtered = Object.keys(changelog).filter(pkg => !specialPackages.includes(pkg));
    filtered.sort();
    return ['separator', ...specialPackages.filter(pkg => changelog[pkg]), 'separator', ...filtered];
}

/**
 * Pure: compute which form fields should be disabled for index search form.
 * @param {Object} formParams - { stable_version, package, version, commitMessage, commitHash }
 * @returns {Object} { disable: { package, version, commitMessage, commitHash, searchButton } }
 */
export function computeFormState(formParams) {
    const p = formParams || {};
    const disable = {
        package: false,
        version: false,
        commitMessage: false,
        commitHash: false,
        searchButton: true
    };

    if (!p.stable_version || p.stable_version.trim() === '') {
        disable.package = true;
        disable.version = true;
        disable.commitMessage = true;
        disable.commitHash = true;
        disable.searchButton = true;
        return { disable };
    }
    disable.commitMessage = false;
    disable.commitHash = false;
    if (!p.package || p.package.trim() === '') {
        disable.version = true;
    } else {
        disable.searchButton = false;
    }
    if (p.version && p.version.trim() !== '') {
        disable.version = false;
        disable.commitMessage = true;
        disable.commitHash = true;
        disable.searchButton = false;
    } else if ((p.commitMessage && p.commitMessage.trim() !== '') || (p.commitHash && p.commitHash.trim() !== '')) {
        disable.version = true;
        disable.searchButton = false;
    }
    return { disable };
}

/* ============================================
   ENHANCED VERSION COMPARISON HELPERS
   ============================================ */

/**
 * Get union of packages from both versions (all packages that exist in either version)
 * @param {Object} changelogA - Changelog data for version A
 * @param {Object} changelogB - Changelog data for version B
 * @returns {Array} - Array of all package names (union)
 */
export const getUnionPackages = (changelogA, changelogB) => {
    const packagesA = new Set(Object.keys(changelogA));
    const packagesB = new Set(Object.keys(changelogB));
    
    // Create union of both package sets
    const allPackages = new Set([...packagesA, ...packagesB]);
    
    // Prioritize certain packages
    const specialPackages = ['webex', '@webex/calling'];
    const filtered = [...allPackages].filter(pkg => !specialPackages.includes(pkg));
    filtered.sort();
    
    return [...specialPackages.filter(pkg => allPackages.has(pkg)), ...filtered];
};


/* ============================================
   MODULAR DATA HELPER FUNCTIONS (Pure Functions)
   ============================================ */

/**
 * Find the latest version of a package in a changelog by published date
 * @param {Object} changelog - The changelog object
 * @param {string} packageName - Package name to search for
 * @returns {string|null} Latest version string or null if not found
 */
export const findLatestPackageVersion = (changelog, packageName) => {
    if (!changelog[packageName]) return null;
    
    const versions = Object.keys(changelog[packageName]);
    if (versions.length === 0) return null;
    
    // Find the latest version by published date
    let latestVersion = versions[0];
    let latestDate = changelog[packageName][versions[0]].published_date || 0;
    
    versions.forEach(ver => {
        const publishedDate = changelog[packageName][ver].published_date || 0;
        if (publishedDate > latestDate) {
            latestDate = publishedDate;
            latestVersion = ver;
        }
    });
    
    return latestVersion;
};

/**
 * Get effective version with fallback to latest if requested version doesn't exist
 * @param {Object} changelog - The changelog object
 * @param {string} packageName - Package name
 * @param {string} requestedVersion - The requested version
 * @returns {string|null} Effective version to use
 */
export const getEffectiveVersion = (changelog, packageName, requestedVersion) => {
    // If requested version exists, use it
    if (changelog[packageName]?.[requestedVersion]) {
        return requestedVersion;
    }
    
    // Otherwise, fallback to latest version
    return findLatestPackageVersion(changelog, packageName);
};

/**
 * Determine the comparison status between two package versions
 * @param {string|null} versionA - Version A (or null if not present)
 * @param {string|null} versionB - Version B (or null if not present)
 * @param {Object|null} dataA - Package data A
 * @param {Object|null} dataB - Package data B
 * @returns {Object} Status object with {status, changeClass}
 */
export const determinePackageStatus = (versionA, versionB, dataA, dataB) => {
    if (!dataA && dataB) {
        return { status: 'Added', changeClass: 'only-in-b' };
    }
    
    if (dataA && !dataB) {
        return { status: 'Removed', changeClass: 'only-in-a' };
    }
    
    if (versionA !== versionB) {
        return { status: 'Version Changed', changeClass: 'version-changed' };
    }
    
    return { status: 'Unchanged', changeClass: 'unchanged' };
};

/**
 * Create a package comparison row object
 * @param {string} packageName - Package name
 * @param {string|null} versionA - Version A
 * @param {string|null} versionB - Version B
 * @param {Object} statusInfo - Status information {status, changeClass}
 * @returns {Object} Package row object
 */
export const createPackageComparisonRow = (packageName, versionA, versionB, statusInfo) => {
    return {
        packageName,
        versionA: versionA || 'N/A',
        versionB: versionB || 'N/A',
        status: statusInfo.status,
        changeClass: statusInfo.changeClass
    };
};

/**
 * Get package version from alongWith data or changelog
 * @param {string} packageName - Package name
 * @param {Object} alongWithData - The alongWith object
 * @param {Object} changelog - The changelog object
 * @returns {string|null} Package version or null
 */
export const getPackageVersion = (packageName, alongWithData, changelog) => {
    // Priority 1: Check alongWith data
    if (alongWithData[packageName]) {
        return alongWithData[packageName];
    }
    
    // Priority 2: Find latest version in changelog
    return findLatestPackageVersion(changelog, packageName);
};

/**
 * Calculate comparison statistics from packages array
 * @param {Array} packages - Array of package comparison objects
 * @returns {Object} Statistics object
 */
export const calculateComparisonStats = (packages) => {
    const stats = {
        changedCount: 0,
        unchangedCount: 0,
        onlyInACount: 0,
        onlyInBCount: 0
    };
    
    packages.forEach(pkg => {
        switch (pkg.status) {
            case 'Version Changed':
                stats.changedCount++;
                break;
            case 'Unchanged':
                stats.unchangedCount++;
                break;
            case 'Removed':
                stats.onlyInACount++;
                break;
            case 'Added':
                stats.onlyInBCount++;
                break;
        }
    });
    
    return stats;
};

/**
 * Build complete packages list including main package and all related packages
 * @param {string} mainPackage - Main package name
 * @param {string} effectiveVersionA - Effective version A
 * @param {string} effectiveVersionB - Effective version B
 * @param {Object} pkgDataA - Package data A
 * @param {Object} pkgDataB - Package data B
 * @param {Object} changelogA - Changelog A
 * @param {Object} changelogB - Changelog B
 * @returns {Array} Array of package comparison objects
 */
export const buildPackagesList = (mainPackage, effectiveVersionA, effectiveVersionB, pkgDataA, pkgDataB, changelogA, changelogB) => {
    const packagesArray = [];
    
    // Add main package row
    const mainStatus = determinePackageStatus(effectiveVersionA, effectiveVersionB, pkgDataA, pkgDataB);
    packagesArray.push(createPackageComparisonRow(mainPackage, effectiveVersionA, effectiveVersionB, mainStatus));
    
    // Get alongWith data
    const alongWithA = pkgDataA?.alongWith || {};
    const alongWithB = pkgDataB?.alongWith || {};
    
    // Get all packages from both changelogs
    const allPackages = new Set([
        ...Object.keys(changelogA),
        ...Object.keys(changelogB)
    ]);
    
    // Remove main package (already added)
    allPackages.delete(mainPackage);
    
    // Add comparison rows for all related packages
    allPackages.forEach(pkg => {
        const pkgVerA = getPackageVersion(pkg, alongWithA, changelogA);
        const pkgVerB = getPackageVersion(pkg, alongWithB, changelogB);
        
        const statusInfo = determinePackageStatus(
            pkgVerA, 
            pkgVerB, 
            pkgVerA ? {} : null,  // Simplified - just check if version exists
            pkgVerB ? {} : null
        );
        
        packagesArray.push(createPackageComparisonRow(pkg, pkgVerA, pkgVerB, statusInfo));
    });
    
    // Sort packages alphabetically
    packagesArray.sort((a, b) => a.packageName.localeCompare(b.packageName));
    
    return packagesArray;
};

/* ============================================
   MAIN DATA LAYER FUNCTION
   ============================================ */

/**
 * DATA LAYER: Generate package comparison data (Orchestrates modular helpers)
 * @param {string} packageName - Package to compare
 * @param {string} versionASpecific - Specific version in base (e.g., 3.3.1-next.22)
 * @param {string} versionBSpecific - Specific version in target (e.g., 3.4.0-next.25)
 * @param {Object} changelogA - Changelog for base stable version
 * @param {Object} changelogB - Changelog for target stable version
 * @returns {Object} Comparison data object
 * @throws {Error} If no data found for comparison
 */
export const generatePackageComparisonData = (packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
    // Step 1: Determine effective versions (with fallback to latest)
    const effectiveVersionA = getEffectiveVersion(changelogA, packageName, versionASpecific);
    const effectiveVersionB = getEffectiveVersion(changelogB, packageName, versionBSpecific);

    // Step 2: Get package data
    const pkgDataA = changelogA[packageName]?.[effectiveVersionA];
    const pkgDataB = changelogB[packageName]?.[effectiveVersionB];
    
    // Step 3: Validate data exists
    if (!pkgDataA && !pkgDataB) {
        throw new Error('Could not find version data for comparison in either version');
    }
    
    // Step 4: Build complete packages list (main + related packages)
    const packages = buildPackagesList(
        packageName,
        effectiveVersionA,
        effectiveVersionB,
        pkgDataA,
        pkgDataB,
        changelogA,
        changelogB
    );
    
    // Step 5: Calculate statistics
    const stats = calculateComparisonStats(packages);
    
    // Step 6: Extract commits from both versions
    const commitsA = pkgDataA?.commits || {};
    const commitsB = pkgDataB?.commits || {};
    
    // Convert commits to arrays for easier template rendering
    const commitsArrayA = Object.entries(commitsA).map(([hash, message]) => ({
        hash: hash,
        shortHash: hash.substring(0, 7),
        message: message,
        url: `${github_base_url}commit/${hash}`
    }));
    
    const commitsArrayB = Object.entries(commitsB).map(([hash, message]) => ({
        hash: hash,
        shortHash: hash.substring(0, 7),
        message: message,
        url: `${github_base_url}commit/${hash}`
    }));
    
    // Step 7: Return complete comparison data with commits
    return {
        versionA: effectiveVersionA,
        versionB: effectiveVersionB,
        packages: packages,
        totalPackages: packages.length,
        packageName: packageName,
        commitsA: commitsArrayA,
        commitsB: commitsArrayB,
        hasCommitsA: commitsArrayA.length > 0,
        hasCommitsB: commitsArrayB.length > 0,
        commitsCountA: commitsArrayA.length,
        commitsCountB: commitsArrayB.length,
        ...stats
    };
};

/* ============================================
   VERSION RANGE & COMMIT AGGREGATION (Pure)
   ============================================ */

/**
 * Get sorted list of version keys (e.g. ['v0.0.0', 'v1.0.0', ...])
 * @param {Object} versionPaths - Map of version key to changelog path
 * @returns {Array<string>}
 */
export const getSortedVersionKeys = (versionPaths) => {
    return Object.keys(versionPaths).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
    );
};

/**
 * Get version keys in range between two stable versions (inclusive)
 * @param {Object} versionPaths - Map of version key to changelog path
 * @param {string} stableVersion1 - e.g. 'v3.4.0'
 * @param {string} stableVersion2 - e.g. 'v3.7.0'
 * @returns {Array<string>} Version keys in range
 */
export const getVersionRange = (versionPaths, stableVersion1, stableVersion2) => {
    const allVersions = getSortedVersionKeys(versionPaths);
    const v1 = stableVersion1.replace(/^v/, '');
    const v2 = stableVersion2.replace(/^v/, '');
    const startIdx = allVersions.indexOf(stableVersion1);
    const endIdx = allVersions.indexOf(stableVersion2);
    if (startIdx === -1 || endIdx === -1) return [];
    const [minIdx, maxIdx] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    return allVersions.slice(minIdx, maxIdx + 1);
};

/**
 * Collect all commits for a package between two stable versions from pre-fetched changelogs.
 * Pure: no fetch, no DOM. Caller must pass versionPaths (for range order) and changelogs keyed by version.
 * @param {string} packageName - Package name
 * @param {string} stableVersion1 - e.g. 'v3.4.0'
 * @param {string} stableVersion2 - e.g. 'v3.7.0'
 * @param {Object} versionPaths - Map of version key to path (used for range order)
 * @param {Object} changelogsByVersion - { 'v3.4.0': changelogObj, ... }
 * @returns {Object} { commits: Array<{hash, shortHash, message, version, stableVersion, url}> }
 */
export const collectAllCommitsBetweenStableVersions = (
    packageName,
    stableVersion1,
    stableVersion2,
    versionPaths,
    changelogsByVersion
) => {
    const versionKeys = getVersionRange(versionPaths, stableVersion1, stableVersion2);
    const allCommits = [];
    for (const versionKey of versionKeys) {
        const changelog = changelogsByVersion[versionKey];
        if (!changelog || !changelog[packageName]) continue;
        const stableVersion = versionKey.replace(/^v/, '');
        const packageVersions = changelog[packageName];
        for (const [pkgVersion, pkgData] of Object.entries(packageVersions)) {
            if (pkgData.commits) {
                for (const [hash, message] of Object.entries(pkgData.commits)) {
                    allCommits.push({
                        hash,
                        shortHash: hash.substring(0, 7),
                        message,
                        version: pkgVersion,
                        stableVersion,
                        url: `${github_base_url}commit/${hash}`
                    });
                }
            }
        }
    }
    const uniqueCommits = Array.from(new Map(allCommits.map((c) => [c.hash, c])).values());
    return { commits: uniqueCommits };
};

/* ============================================
   PRERELEASE OPTIONS (Pure, data-only)
   ============================================ */

/**
 * Get prerelease version options for a package in a changelog (data only, no DOM).
 * Filters pre-release versions matching the stable version, sorted by published date (newest first).
 * @param {string} packageName - Package name
 * @param {Object} changelog - Changelog for one stable version
 * @param {string} stableVersion - e.g. 'v3.7.0'
 * @returns {Object} { options: Array<{value, displayText, isDefault}>, defaultValue }
 */
export const getPrereleaseOptionsForStableVersion = (packageName, changelog, stableVersion) => {
    const stableVersionKey = stableVersion.replace(/^v/, '');
    if (!changelog[packageName]) {
        return {
            options: [{ value: stableVersionKey, displayText: `${stableVersionKey} (default)`, isDefault: true }],
            defaultValue: stableVersionKey
        };
    }
    const allVersions = Object.keys(changelog[packageName]);
    const prereleaseVersions = allVersions.filter(
        (v) => v.startsWith(stableVersionKey + '-') && v !== stableVersionKey
    );
    prereleaseVersions.sort((a, b) => {
        const dateA = changelog[packageName][a]?.published_date || 0;
        const dateB = changelog[packageName][b]?.published_date || 0;
        return dateB - dateA;
    });
    const versionsToShow = [];
    let isStableVersionDefault = false;
    if (changelog[packageName][stableVersionKey]) {
        versionsToShow.push(stableVersionKey);
        isStableVersionDefault = prereleaseVersions.length === 0;
    }
    versionsToShow.push(...prereleaseVersions);
    if (versionsToShow.length === 0) {
        versionsToShow.push(stableVersionKey);
        isStableVersionDefault = true;
    }
    const options = versionsToShow.map((version) => {
        const isStable = version === stableVersionKey;
        const showDefault = isStable && isStableVersionDefault;
        return {
            value: version,
            displayText: showDefault ? `${version} (default)` : version,
            isDefault: showDefault
        };
    });
    return { options, defaultValue: versionsToShow[0] };
};
