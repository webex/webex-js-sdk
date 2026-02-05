// Global variable to store the current changelog and version paths
let currentChangelog;
const versionPaths = {};
export const github_base_url = "https://github.com/webex/webex-js-sdk/";

// DOM elements
const versionSelectDropdown = document.getElementById('version-select');
const packageNameInputDropdown = document.getElementById('package-name-input');
const packageInputGroup = document.getElementById('package-input-group');
const versionInput = document.getElementById('version-input');
const versionInputError = document.getElementById('version-input-error');
const versionInputGroup = document.getElementById('version-input-group');
const commitMessageInput = document.getElementById('commit-message-input');
const commitMessageGroup = document.getElementById('commit-message-group');
const commitHashInput = document.getElementById('commit-hash-input');
const commitHashGroup = document.getElementById('commit-hash-group');
const searchForm = document.getElementById('search-form');
const searchButton = document.getElementById('search-button');
const searchResults = document.getElementById('search-results');

// DOM elements - Shared
const helperSection = document.getElementById('helper-section');

// Initialize UI state - only if elements exist (for compare.html compatibility)
if (searchResults) searchResults.classList.add('hide');

// Templates and Helpers - Handlebar (only if template exists)
const changelogItemTemplate = document.getElementById('changelog-item-template');
var changelogUI = changelogItemTemplate ? Handlebars.compile(changelogItemTemplate.innerHTML) : null;
if (Handlebars && changelogItemTemplate) {
  Handlebars.registerHelper("forIn", function(object) {
      let returnArray = [];
      for(let prop in object){
        returnArray.push({key: prop, value: object[prop]});
      }
      return returnArray;
  });

  Handlebars.registerHelper('json', function(context, pkgName, version) {
      const copyElem = {
          ...context,
        [pkgName]: version
    }
    return JSON.stringify(copyElem);
  });
}

Handlebars.registerHelper('github_linking', function(string, type) {
    switch(type){
        case 'hash':
            return `<a href='${github_base_url}commit/${string}' target='_blank'>${string}</a>`;
        case 'message':
            // if commit message has a pr number, replace that pr number with pr anchor link and send back the transformed commit message
            return string.replace(/#(\d+)/g, `<a href="${github_base_url}pull/$1" target="_blank">#$1</a>`);
    }
});

Handlebars.registerHelper('convertDate', function(timestamp) {
    return `${new Date(timestamp).toDateString()} ${new Date(timestamp).toTimeString()}`;
});

// Util Methods
const populateFormFieldsFromURL = async () => {
    const queryParams = new URLSearchParams(window.location.search);
    
    const searchParams = {
        stable_version: queryParams.get('stable_version'),
        package: queryParams.get('package'),
        version: queryParams.get('version'),
        commitMessage: queryParams.get('commitMessage'),
        commitHash: queryParams.get('commitHash')
    };

    let hasAtleastOneParam = false;
  
    if (searchParams.stable_version) {
      versionSelectDropdown.value = searchParams.stable_version;
      await doStableVersionChange({
        stable_version: searchParams.stable_version
      });
    }
  
    if (searchParams.package) {
        if (!packageNameInputDropdown.disabled) {
            packageNameInputDropdown.value = searchParams.package;
            packageNameInputDropdown.dispatchEvent(new Event('change'));
            hasAtleastOneParam = true;
        }
    }
  
    if (searchParams.version) {
      versionInput.value = searchParams.version;
      hasAtleastOneParam = true;
      validateVersionInput({version: searchParams.version});
    }
  
    if (searchParams.commitMessage) {
      commitMessageInput.value = searchParams.commitMessage;
      hasAtleastOneParam = true;
    }
  
    if (searchParams.commitHash) {
      commitHashInput.value = searchParams.commitHash;
      hasAtleastOneParam = true;
    }

    updateFormState(searchParams);

    if(hasAtleastOneParam){
        doSearch(searchParams);
    }
};

const populateVersions = async () => {
    try {
        const response = await fetch('logs/main.json');
        const data = await response.json();
        let optionsHtml = '<option value="">Select a version</option>'; // Placeholder option

        Object.entries(data).forEach(([version, path]) => {
            versionPaths[version] = path;
            optionsHtml += `<option value="${version}">${version}</option>`;
        });

        versionSelectDropdown.innerHTML = optionsHtml; // Set all options at once

        // Call populateFormFieldsFromURL on page load to populate fields based on URL parameters
        populateFormFieldsFromURL();
    } catch (error) {
        console.error('Error fetching version data:', error);
    }
};
const fetchChangelog = async (versionPath) => {
    try {
        const response = await fetch(versionPath);
        currentChangelog = await response.json();
    } catch (error) {
        console.error('Error fetching changelog:', error);
    }
};

const populatePackageNames = (changelog) => {
    let specialPackages = ['webex', '@webex/calling'];
    let filteredPackages = Object.keys(changelog).filter(pkg => !specialPackages.includes(pkg));

    // Sort the remaining packages alphabetically
    filteredPackages.sort();

    // Add 'webex' and '@webex/calling' back to the beginning of the array
    let sortedPackages = ['separator', ...specialPackages, 'separator', ...filteredPackages];
    let optionsHtml = '<option value="">Select a package</option>'; // Placeholder option

    sortedPackages.forEach((packageName) => {
        if(packageName === 'separator'){
            optionsHtml += `<option disabled>──────────</option>`;
            return;
        }
        optionsHtml += `<option value="${packageName}">${packageName}</option>`;
    });

    packageNameInputDropdown.value = "webex";
    packageNameInputDropdown.innerHTML = optionsHtml; // Set all options at once
};

const doStableVersionChange = async ({stable_version}) => {
    if (stable_version && versionPaths[stable_version]) {
        // Enable the package-name-input dropdown
        packageNameInputDropdown.disabled = false;
        // Fetch the changelog and populate package names
        await fetchChangelog(versionPaths[stable_version]);
        populatePackageNames(currentChangelog);
        
        updateFormState();
        if(versionInput.value.trim() !== ''){
            validateVersionInput({version: versionInput.value});
        }
    } else {
        // Disable all other form elements if no version is selected
        updateFormState();
    }
};

// Search Form Utils
const validateVersionInput = ({version}) => {
    const stableVersion = versionSelectDropdown.value;
    const expectedPattern = new RegExp(`^${stableVersion}-([a-z\-]*\\.)?\\d+$`, 'i');

    if (version !== "" && !expectedPattern.test(version) && stableVersion !== version) {
        versionInputError.innerText = `Version can be empty or should start with ${stableVersion} and match ${stableVersion}-{tag}.patch_version. Eg: ${stableVersion}-next.1`;
        versionInput.focus();
        searchButton.disabled = true;
    }
    else{
        versionInputError.innerText = ``;
        searchButton.disabled = false;
    }
}

const updateFormState = (formParams) => {
    // If the stable version is empty, show no more fields and disable the search button
    // If the package name is empty, hide version input and show commit options
    // If the package name is not empty, show all options
    // If one of the commit search options is not empty, hide version input and show commit search options
    // If the version field is not empty, hide the commit search options
    if(formParams === undefined){
        formParams = {
            stable_version: versionSelectDropdown.value,
            package: packageNameInputDropdown.value,
            version: versionInput.value,
            commitMessage: commitMessageInput.value,
            commitHash: commitHashInput.value
        };
    }

    const disable = {
        package: false,
        version: false,
        commitMessage: false,
        commitHash: false,
        searchButton: true
    };

    if(formParams.stable_version === null || formParams.stable_version.trim() === ''){
        disable.package = true;
        disable.version = true;
        disable.commitMessage = true;
        disable.commitHash = true;
        disable.searchButton = true;
    }
    else{
        disable.package = false;
        disable.commitMessage = false;
        disable.commitHash = false;
    }
    //If the package name is empty, disable the version input
    if(formParams.package === null || formParams.package.trim() === ''){
        disable.version = true;
    }
    else{
        disable.searchButton = false;
    }
//     If version filled → disable commit fields
// If commit fields filled → disable version input
    if(formParams.version && formParams.version.trim() !== ''){
        disable.version = false;
        disable.commitMessage = true;
        disable.commitHash = true;
        disable.searchButton = false;
    }
    else if((formParams.commitMessage && formParams.commitMessage.trim() !== '') || (formParams.commitHash && formParams.commitHash.trim() !== '')){
        disable.version = true;
        disable.searchButton = false;
    }

    for(let key in disable){
        switch(key){
            case 'package':
                if(disable[key]){
                    packageNameInputDropdown.disabled = true;
                    packageNameInputDropdown.value = "";
                    packageInputGroup.classList.add('hide');
                    formParams.package = null;
                }
                else{
                    packageNameInputDropdown.disabled = false;
                    packageInputGroup.classList.remove('hide');
                }
                break;
            case 'version':
                if(disable[key]){
                    versionInput.disabled = true;
                    versionInput.value = "";
                    versionInputGroup.classList.add('hide');
                    formParams.version = null;
                }
                else{
                    versionInput.disabled = false;
                    versionInputGroup.classList.remove('hide');
                }
                break;
            case 'commitMessage':
                if(disable[key]){
                    commitMessageInput.disabled = true;
                    commitMessageInput.value = "";
                    commitMessageGroup.classList.add('hide');
                    formParams.commitMessage = null;
                }
                else{
                    commitMessageInput.disabled = false;
                    commitMessageGroup.classList.remove('hide');
                }
                break;
            case 'commitHash':
                if(disable[key]){
                    commitHashInput.disabled = true;
                    commitHashInput.value = "";
                    commitHashGroup.classList.add('hide');
                    formParams.commitHash = null;
                }
                else{
                    commitHashInput.disabled = false;
                    commitHashGroup.classList.remove('hide');
                }
                break;
            case 'searchButton':
                searchButton.disabled = disable[key];
                break;
        }
    }
};
// Search changelog by commit message or hash.(A single commit can appear in multiple package versions.)
const doSearch_commit = (searchParams, drill_down) => {
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

const doSearch = (searchParams) => {
    const { package: pkgName, version } = searchParams;
    let drill_down = {...currentChangelog}, shouldTransform = true, search_results = [];
// If package selected → filter to that package
    if(pkgName !== null && pkgName?.trim() !== ""){
        drill_down = {
            [pkgName]: drill_down[pkgName]
        };
    }
// If version selected → filter to that version
    if(version !== null && version?.trim() !== ""){
        drill_down = drill_down[pkgName][version] ? {
            [pkgName]: {
                [version]: drill_down[pkgName][version]
            }
        } : {};
    }
    else if(// If searching by commit → call doSearch_commit()
        searchParams.commitMessage !== null && searchParams.commitMessage?.trim() !== "" || 
        searchParams.commitHash !== null && searchParams.commitHash?.trim() !== ""
    ){
        search_results = doSearch_commit(searchParams, drill_down);
        shouldTransform = false;
    }

    if(shouldTransform){
        Object.keys(drill_down).forEach((pkgName) => {
            Object.keys(drill_down[pkgName]).forEach((version) => {
                search_results.push({
                    package: pkgName,
                    version,
                    published_date: drill_down[pkgName][version].published_date,
                    commits: drill_down[pkgName][version].commits,
                    alongWith: drill_down[pkgName][version].alongWith,
                });
            });
        });
    }

    // sort search results based on published date which will be in Unit timestamp
    search_results.sort((a, b) => b.published_date - a.published_date);

    const searchResultsHtml = changelogUI({data: {
        search_results,
        stable_version: searchParams.stable_version,
    }});
    
    searchResults.innerHTML = searchResultsHtml;
    searchResults.classList.remove('hide');
};

// Event listeners (only if elements exist - for compare.html compatibility)
if (versionSelectDropdown) versionSelectDropdown.addEventListener('change', (event) => doStableVersionChange({stable_version: event.target.value}));

[
    versionInput,
    commitHashInput,
    commitMessageInput
].forEach((element) => {
    if (element) element.addEventListener('keyup', () => updateFormState());
});

if (packageNameInputDropdown) packageNameInputDropdown.addEventListener('change', () => updateFormState());

if (versionInput) versionInput.addEventListener('keyup', (event) => validateVersionInput({version: event.target.value}));

if (searchForm) searchForm.addEventListener('submit', (event) => {
    // Prevent the default form submission
    event.preventDefault();

    // Construct the query string only with non-empty values
    const queryParams = new URLSearchParams();
    if (versionSelectDropdown.value) {
      queryParams.set('stable_version', versionSelectDropdown.value);
    }
    if (packageNameInputDropdown.value) {
      queryParams.set('package', packageNameInputDropdown.value);
    }
    if (versionInput.value) {
      queryParams.set('version', versionInput.value);
    }
    if (commitMessageInput.value) {
      queryParams.set('commitMessage', commitMessageInput.value);
    }
    if (commitHashInput.value) {
      queryParams.set('commitHash', commitHashInput.value);
    }

    // Redirect to the same page with the query string
    window.history.pushState({}, 'Cisco Webex JS SDK', `${window.location.pathname}?${queryParams.toString()}`);
    populateVersions();
});

const copyToClipboard = (copyButton) => {
    navigator.clipboard.writeText(JSON.stringify(JSON.parse(copyButton.dataset.alongWith), null, 4));
    const copyText = copyButton.querySelector('span');
    copyText.textContent = 'Copied!';
    setTimeout(() => { 
        copyText.textContent = 'Copy';
    },2000);
}


window.onhashchange = () => {
    populateVersions();
};

populateVersions();


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
    
    console.log('effectiveVersionA:', effectiveVersionA, '(requested:', versionASpecific, ')');
    console.log('effectiveVersionB:', effectiveVersionB, '(requested:', versionBSpecific, ')');
    
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
