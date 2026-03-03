// Global variable to store the current changelog and version paths
let currentChangelog;
const versionPaths = {};
const github_base_url = "https://github.com/webex/webex-js-sdk/";

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

// DOM elements - Comparison Mode
const comparisonResults = document.getElementById('comparison-results');
const comparisonTemplateElement = document.getElementById('comparison-template');
const comparisonForm = document.getElementById('comparison-form');
const singleViewBtn = document.getElementById('single-view-btn');
const comparisonViewBtn = document.getElementById('comparison-view-btn');
const versionASelect = document.getElementById('version-a-select');
const versionBSelect = document.getElementById('version-b-select');
const comparisonPackageSelect = document.getElementById('comparison-package-select');
const comparisonPackageRow = document.getElementById('comparison-package-row');
const versionAPrereleaseSelect = document.getElementById('version-a-prerelease-select');
const versionBPrereleaseSelect = document.getElementById('version-b-prerelease-select');
const prereleaseRow = document.getElementById('comparison-prerelease-row');
const compareButton = document.getElementById('compare-button');
const clearComparisonButton = document.getElementById('clear-comparison-button');
const copyComparisonLinkBtn = document.getElementById('copy-comparison-link');
const comparisonHelper = document.getElementById('comparison-helper');

// DOM elements - Shared
const helperSection = document.getElementById('helper-section');
const packageLevelSection = document.getElementById('package-level-comparison-section');

// Initialize UI state
searchResults.classList.add('hide');

// Templates and Helpers - Handlebar
const changelogItemTemplate = document.getElementById('changelog-item-template');
var changelogUI = Handlebars.compile(changelogItemTemplate.innerHTML);
Handlebars.registerHelper("forIn", function(object) {
    let returnArray = [];
    for(let prop in object){
      returnArray.push({key: prop, value: object[prop]});
    }
    return returnArray;
});

Handlebars.registerHelper('json', function(context, package, version) {
    const copyElem = {
        ...context,
        [package]: version
    }
    return JSON.stringify(copyElem);
});

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
    
    // Skip single-view URL handling if comparison parameters are present
    if (queryParams.has('compare') || (queryParams.has('versionA') && queryParams.has('versionB'))) {
        return; // Comparison mode will handle these parameters
    }
    
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
    for(let package in drill_down){
        const thisPackage = drill_down[package];
        for(let version in thisPackage){
            const thisVersion = thisPackage[version];
            let allHashes = new Set(), discontinueSearch = false;
            for(let hash in thisVersion.commits){
                const thisCommit = thisVersion.commits[hash];
                if(discontinueSearch){
                    resulting_versions.add(`${package}-${version}`);
                    resulting_commit_messages.add(thisCommit);
                    allHashes.forEach(h => resulting_commit_hash.add(h));
                }
                else{
                    allHashes.add(hash);
                    if(!resulting_versions.has(`${package}-${version}`) && 
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
                            resulting_versions.add(`${package}-${version}`);
                            resulting_commit_messages.add(thisCommit);
                            allHashes.forEach(h => resulting_commit_hash.add(h));
                            allHashes = new Set();
                            discontinueSearch = true;
                            search_results.push({
                                package,
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
    const { package, version } = searchParams;
    let drill_down = {...currentChangelog}, shouldTransform = true, search_results = [];
// If package selected → filter to that package
    if(package !== null && package?.trim() !== ""){
        drill_down = {
            [package]: drill_down[package]
        };
    }
// If version selected → filter to that version
    if(version !== null && version?.trim() !== ""){
        drill_down = drill_down[package][version] ? {
            [package]: {
                [version]: drill_down[package][version]
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
        Object.keys(drill_down).forEach((package) => {
            Object.keys(drill_down[package]).forEach((version) => {
                search_results.push({
                    package,
                    version,
                    published_date: drill_down[package][version].published_date,
                    commits: drill_down[package][version].commits,
                    alongWith: drill_down[package][version].alongWith,
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

// Event listeners
versionSelectDropdown.addEventListener('change', (event) => doStableVersionChange({stable_version: event.target.value}));

[
    versionInput,
    commitHashInput,
    commitMessageInput
].forEach((element) => {
    element.addEventListener('keyup', () => updateFormState());
});

packageNameInputDropdown.addEventListener('change', () => updateFormState());

versionInput.addEventListener('keyup', (event) => validateVersionInput({version: event.target.value}));

searchForm.addEventListener('submit', (event) => {
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

/**
 * Copy comparison link to clipboard
 * Global function that can be called from HTML or JS
 */
const copyComparisonLink = () => {
    const currentURL = window.location.href;
      
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentURL)
            .then(() => {
                showCopySuccess(copyComparisonLinkBtn);
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopyToClipboard(currentURL, copyComparisonLinkBtn);
            });
    } else {
        fallbackCopyToClipboard(currentURL, copyComparisonLinkBtn);
    }
}

/**
 * Show success feedback on copy button
 */
const showCopySuccess = (button) => {
    if (!button) return;
    
    const originalText = button.innerHTML;
    button.innerHTML = '✓ Link Copied!';
    button.style.backgroundColor = 'var(--color-success)';
    button.style.borderColor = 'var(--color-success)';
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        button.style.borderColor = '';
    }, 2000);
}

/**
 * Fallback copy method for browsers without Clipboard API (Older browsers don't support navigator.clipboard)
 */
const fallbackCopyToClipboard = (text, button) => {
    // Create temporary input element
    const tempInput = document.createElement('input');
    tempInput.style.position = 'fixed';
    tempInput.style.opacity = '0';
    tempInput.value = text;
    document.body.appendChild(tempInput);
    
    // Select and copy
    tempInput.select();
    tempInput.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess(button);
        } else {
            console.error('execCommand copy failed');
            showCopyError(button);
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyError(button);
    }
    
    // Remove temporary input
    document.body.removeChild(tempInput);
}

/**
 * Show error feedback
 */
const showCopyError = (button) => {
    if (!button) {
        alert('Could not copy link. Please copy manually from the address bar.');
        return;
    }
    
    const originalText = button.innerHTML;
    button.innerHTML = '❌ Copy Failed';
    button.style.backgroundColor = 'var(--color-danger)';
    button.style.borderColor = 'var(--color-danger)';
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.style.backgroundColor = '';
        button.style.borderColor = '';
    }, 2000);
    
    // Also show alert with instructions
    setTimeout(() => {
        alert('Could not copy link automatically.\n\nPlease copy manually from the address bar:\n' + window.location.href);
    }, 100);
}

window.onhashchange = () => {
    populateVersions();
};

populateVersions();

/**
 * Populate package dropdown for comparison
 * @param {string} selectId - ID of the select element
 */
/* ============================================
   VERSION COMPARISON FUNCTIONALITY
   ============================================ */

// Global state for comparison mode
let comparisonMode = false;

/**
 * Extract all packages from a version changelog
 * @param {Object} changelog - The changelog JSON for a version
 * @param {Object} specificVersions - Optional map of {packageName: specificVersion}
 * @returns {Object} - Map of {packageName: version}
 */
const extractPackagesFromVersion = (changelog, specificVersions = null) => {
    const packageMap = {};
    
    for (const packageName of Object.keys(changelog)) {
        
        const packageVersions = changelog[packageName];
        console.log('packageVersions', packageVersions);
        
        // Safety check: ensure packageVersions is an object
        if (!packageVersions || typeof packageVersions !== 'object') continue;
        
        const versionKeys = Object.keys(packageVersions);
        console.log('versionKeys', versionKeys);
        
        if (versionKeys.length === 0) continue;
        
        let selectedVersion = null;
        
        // Check if user specified a specific version for this package
        if (specificVersions && specificVersions[packageName]) {
            const requestedVersion = specificVersions[packageName];
            if (packageVersions[requestedVersion]) {
                selectedVersion = requestedVersion;
            }
        }
        
        // If no specific version requested or not found, use earliest (first) version
        if (!selectedVersion) {
            let earliestVersion = versionKeys[0];
            let earliestDate = packageVersions[earliestVersion]?.published_date || Infinity;
            
            for (const version of versionKeys) {
                const publishedDate = packageVersions[version]?.published_date || Infinity;
                if (publishedDate < earliestDate) {
                    earliestDate = publishedDate;
                    earliestVersion = version;
                }
            }
            
            selectedVersion = earliestVersion;
        }
        
        packageMap[packageName] = selectedVersion;
    }

    return packageMap;
};

/**
 * Compare packages between two versions
 * @param {Object} packagesA - {packageName: version} for version A
 * @param {Object} packagesB - {packageName: version} for version B
 * @param {Object} changelogA - Full changelog data for version A
 * @param {Object} changelogB - Full changelog data for version B
 * @returns {Object} - Comparison results with statistics
 */
const comparePackages = (packagesA, packagesB, changelogA, changelogB, stableVersionA, stableVersionB) => {
    // Get ALL package names from both changelogs (entire changelog, not just specific versions)
    const allPackageNames = new Set([
        ...Object.keys(changelogA),//ALL packages in changelog A
        ...Object.keys(changelogB)//ALL packages in changelog B
    ]);
    
    const packages = [];
    let changedCount = 0;
    let unchangedCount = 0;
    let onlyInACount = 0;
    let onlyInBCount = 0;
    
    // Helper function to find earliest (first) version of a package in changelog
 // Helper function to find stable version first, then highest pre-release version
const findStableVersion = (changelog, packageName, stableVersion) => {
    if (!changelog[packageName]) return null;
    
    const versions = Object.keys(changelog[packageName]);
    if (versions.length === 0) return null;
    
    // Escape dots in version string for regex (3.4.0 -> 3\.4\.0)
    const escapedVersion = stableVersion.replace(/\./g, '\\.');
    
    // Priority 1: Find exact stable version (e.g., "3.4.0" only, no suffixes)
    const exactStablePattern = new RegExp(`^${escapedVersion}$`);
    const exactStableVersion = versions.find(ver => exactStablePattern.test(ver));
    
    if (exactStableVersion) {
        return exactStableVersion;
    }
    
    // Priority 2: Find highest pre-release version (any tag: next, alpha, beta, rc, etc.)
    // Pattern: 3.4.0-{tag}.{number} -> captures tag and number
    const prereleasePattern = new RegExp(`^${escapedVersion}-([a-z]+)\\.(\\d+)$`, 'i');
    
    const prereleaseVersions = versions
        .filter(ver => prereleasePattern.test(ver))
        .sort((a, b) => {
            const matchA = a.match(prereleasePattern);
            const matchB = b.match(prereleasePattern);
            if (!matchA || !matchB) return 0;
            
            const numA = parseInt(matchA[2], 10);
            const numB = parseInt(matchB[2], 10);
            return numB - numA; // Sort descending (highest first)
        });
    
    // Return highest pre-release version, or fallback to first available
    return prereleaseVersions[0] || versions[0];
};
    
    allPackageNames.forEach(packageName => {
        // Find the earliest (first) version for this package in each changelog
        const versionA = findStableVersion(changelogA, packageName, stableVersionA);
        const versionB = findStableVersion(changelogB, packageName, stableVersionB);
        
        let status, changeClass;//Declare variables for status label and CSS class
        
        if (versionA && versionB) {//checks if package is in both changelogs
            if (versionA === versionB) {//if versionA is the same as versionB, then it is unchanged
                status = 'Unchanged';
                changeClass = 'unchanged';
                unchangedCount++;
            } else {
                status = 'Version Changed';
                changeClass = 'version-changed';
                changedCount++;
            }
        } else if (versionA && !versionB) {
            status = 'Removed';
            changeClass = 'only-in-a';
            onlyInACount++;
        } else if (!versionA && versionB) {
            status = 'Added';
            changeClass = 'only-in-b';
            onlyInBCount++;
        }
        
        packages.push({
            packageName,
            versionA: versionA || 'N/A',
            versionB: versionB || 'N/A',
            status,
            changeClass
        });
    });
    
    // Sort packages alphabetically
    packages.sort((a, b) => a.packageName.localeCompare(b.packageName));
    
    return {
        packages,
        totalPackages: allPackageNames.size,
        changedCount,
        unchangedCount,
        onlyInACount,
        onlyInBCount
    };
};

/*
 Populate package dropdowns for comparison mode when version is selected
 @param {string} versionSelectId - ID of the version select element
 @param {string} packageSelectId - ID of the package select element
 */

/* ============================================
   UI HELPER FUNCTIONS
   ============================================ */

/**
 * Show loading state for comparison
 */
const showComparisonLoading = () => {
    if (!comparisonResults) return;
    comparisonResults.innerHTML = '<p style="text-align: center; padding: 20px;">Loading comparison...</p>';
    comparisonResults.classList.remove('hide');
};

/**
 * Show error state for comparison
 * @param {Error} error - The error object
 */
const showComparisonError = (error) => {
    if (!comparisonResults) return;
    
    console.error('Error performing version comparison:', error);
    console.error('Error stack:', error.stack);
    
    comparisonResults.innerHTML = 
        `<div style="color: var(--color-error-text); padding: 20px; background: var(--color-error-bg); border-radius: 5px;">
            <strong>Error:</strong> Failed to compare versions. ${error.message}
            <br><br><small>Check browser console for details (F12)</small>
        </div>`;
};

/* ============================================
   DATA LAYER FUNCTIONS
   ============================================ */

/**
 * DATA LAYER: Fetch and compare versions (Pure data logic, no DOM manipulation)
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 * @returns {Promise<Object>} Comparison data with versionA, versionB, and comparisonData
 * @throws {Error} If fetch fails or comparison fails
 */
const fetchAndCompareVersions = async (versionA, versionB) => {
    // Fetch both changelogs in parallel
    const [changelogA, changelogB] = await Promise.all([
        fetch(versionPaths[versionA]).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${versionA}`);
            return res.json();
        }),
        fetch(versionPaths[versionB]).then(res => {
            if (!res.ok) throw new Error(`Failed to fetch ${versionB}`);
            return res.json();
        })
    ]);
    
    // Extract packages from both versions
    const packagesA = extractPackagesFromVersion(changelogA);
    const packagesB = extractPackagesFromVersion(changelogB);
    
    // Compare packages
    const comparisonData = comparePackages(packagesA, packagesB, changelogA, changelogB,versionA, versionB);
    
    return {
        versionA,
        versionB,
        comparisonData
    };
};

/**
 * UI LAYER: Handle version comparison UI updates
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 */
const performVersionComparison = async (versionA, versionB) => {
    // Show loading state
    showComparisonLoading();
    
    try {
        // Fetch and compare data (pure data logic)
        const result = await fetchAndCompareVersions(versionA, versionB);
        
        // Display results (UI logic)
        displayComparison(result.versionA, result.versionB, result.comparisonData);
        
    } catch (error) {
        // Handle error display (UI logic)
        showComparisonError(error);
    }
};

/**
 * Display comparison results
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 * @param {Object} comparisonData - Comparison results
 */
const displayComparison = (versionA, versionB, comparisonData) => {
    if (!comparisonResults) {
        console.error('comparison-results element not found!');
        return;
    }
    
    if (!comparisonTemplateElement) {
        console.error('comparison-template element not found!');
        return;
    }
    
    const comparisonTemplate = Handlebars.compile(comparisonTemplateElement.innerHTML);
    
    const templateData = {
        versionA,
        versionB,
        ...comparisonData
    };
    
    console.log('Template data:', templateData);
    
    try {
        const html = comparisonTemplate(templateData);
        console.log('Generated HTML length:', html.length);
        
        comparisonResults.innerHTML = html;
        comparisonResults.classList.remove('hide');
        
        // Update URL with comparison parameters for permalinks
        updateComparisonURL(versionA, versionB);
        
        // Show the copy link button and helper text
        if (copyComparisonLinkBtn) {
            copyComparisonLinkBtn.classList.remove('hide');
            console.log('Copy link button shown');
        } else {
            console.warn('Copy link button not found in DOM');
        }
        if (comparisonHelper) {
            comparisonHelper.classList.remove('hide');
        }
        
        // Scroll to results smoothly
        setTimeout(() => {
            comparisonResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        
        console.log('Comparison displayed successfully');
    } catch (error) {
        console.error('Error rendering template:', error);
        comparisonResults.innerHTML = `<div style="color: var(--color-error-text); padding: 20px; background: var(--color-error-bg); border-radius: 5px;">Error rendering comparison: ${error.message}</div>`;
    }
};

/**
 * Update URL with comparison parameters for sharing/bookmarking
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 */
const updateComparisonURL = (versionA, versionB) => {
    const url = new URL(window.location);
    
    // Clear any single-view parameters
    url.searchParams.delete('stable_version');
    url.searchParams.delete('package');
    url.searchParams.delete('version');
    url.searchParams.delete('commitMessage');
    url.searchParams.delete('commitHash');
    
    // Set comparison parameters
    url.searchParams.set('compare', `${versionA}vs${versionB}`);
    
    // Update URL without reloading the page
    window.history.pushState({}, '', url);
};

/**
 * Parse and handle comparison URL parameters
 * Supports formats: ?compare=3.9.0vs3.10.0 or ?versionA=3.9.0&versionB=3.10.0
 */
const handleComparisonURLParams = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    let versionA = null;
    let versionB = null;
    
    // Check for ?compare=AvB format
    const compareParam = urlParams.get('compare');
    if (compareParam && compareParam.includes('vs')) {
        const versions = compareParam.split('vs');
        versionA = versions[0]?.trim();
        versionB = versions[1]?.trim();
    }
    
    // Also support ?versionA=X&versionB=Y format
    if (!versionA) versionA = urlParams.get('versionA');
    if (!versionB) versionB = urlParams.get('versionB');
    
    // If comparison parameters are found, switch to comparison mode
    if (versionA && versionB && versionA !== versionB) {
        return { versionA, versionB, shouldCompare: true };
    }
    
    return { shouldCompare: false };
};

/**
 * Switch to comparison mode programmatically
 * @param {string} versionA - Base version (optional)
 * @param {string} versionB - Target version (optional)
 */
const switchToComparisonMode = (versionA = null, versionB = null) => {
    // Update mode
    comparisonMode = true;
    
    // Update button states
    if (comparisonViewBtn && singleViewBtn) {
        comparisonViewBtn.classList.add('active', 'btn-primary');
        comparisonViewBtn.classList.remove('btn-default');
        singleViewBtn.classList.remove('active', 'btn-primary');
        singleViewBtn.classList.add('btn-default');
    }
    
    // Update form visibility
    if (searchForm) searchForm.classList.add('hide');
    if (comparisonForm) comparisonForm.classList.remove('hide');
    if (searchResults) searchResults.classList.add('hide');
    
    // Hide helper section (search examples) in comparison mode
    if (helperSection) helperSection.classList.add('hide');
    
    // Hide package-level comparison section in version comparison mode
    if (packageLevelSection) packageLevelSection.classList.add('hide');
    
    // Populate version dropdowns
    if (versionSelectDropdown && versionSelectDropdown.innerHTML) {
        const options = versionSelectDropdown.innerHTML;
        if (versionASelect) versionASelect.innerHTML = options;
        if (versionBSelect) versionBSelect.innerHTML = options;
    }
    
    // Set selected versions if provided
    if (versionA && versionASelect) versionASelect.value = versionA;
    if (versionB && versionBSelect) versionBSelect.value = versionB;
};

/* ============================================
   ENHANCED VERSION COMPARISON HELPERS
   ============================================ */

/**
 * Get union of packages from both versions (all packages that exist in either version)
 * @param {Object} changelogA - Changelog data for version A
 * @param {Object} changelogB - Changelog data for version B
 * @returns {Array} - Array of all package names (union)
 */
const getUnionPackages = (changelogA, changelogB) => {
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

/**
 * Populate the package dropdown with union of packages from both versions
 * @param {Object} changelogA - Changelog for base version
 * @param {Object} changelogB - Changelog for target version
 */
const populateUnionPackages = (changelogA, changelogB) => {
    if (!comparisonPackageSelect || !comparisonPackageRow) return;
    
    const allPackages = getUnionPackages(changelogA, changelogB);
    
    if (allPackages.length === 0) {
        comparisonPackageSelect.innerHTML = '<option value="">No packages found</option>';
        comparisonPackageRow.style.display = 'none';
        return;
    }
    
    let optionsHtml = '<option value="">Select a package (optional)</option>';
    allPackages.forEach(pkg => {
        optionsHtml += `<option value="${pkg}">${pkg}</option>`;
    });
    
    comparisonPackageSelect.innerHTML = optionsHtml;
    comparisonPackageRow.style.display = 'flex';
};

/**
 * Populate pre-release versions for a selected package
 * @param {string} packageName - Selected package name
 * @param {Object} changelog - Changelog data
 * @param {string} selectId - ID of the select element to populate
 * @param {string} stableVersion - The stable version (e.g., 3.3.1)
 */
const populatePrereleaseVersions = (packageName, changelog, selectId, stableVersion) => {
    const versionSelect = selectId === 'version-a-prerelease-select' ? versionAPrereleaseSelect : versionBPrereleaseSelect;
    
    if (!versionSelect || !packageName) {
        if (versionSelect) {
            versionSelect.innerHTML = '<option value="">No versions found</option>';
            versionSelect.disabled = true;
        }
        return;
    }
    
    // Check if package exists in this changelog (it might not for union packages)
    if (!changelog[packageName]) {
        if (versionSelect) {
            versionSelect.innerHTML = '<option value="">Package not available in this version</option>';
            versionSelect.disabled = true;
        }
        return;
    }
    
    // Get all versions for this package
    const allVersions = Object.keys(changelog[packageName]);
    
    // Filter for pre-release versions matching the stable version
    // e.g., for stable version 3.3.1, get 3.3.1-next.1, 3.3.1-next.22, etc.
    const prereleaseVersions = allVersions.filter(v => 
        v.startsWith(stableVersion + '-') && v !== stableVersion
    );
    
    // Sort by version (newest first based on published date)
    prereleaseVersions.sort((a, b) => {
        const dateA = changelog[packageName][a]?.published_date || 0;
        const dateB = changelog[packageName][b]?.published_date || 0;
        return dateB - dateA;
    });
    
    let optionsHtml = '<option value="">Select pre-release version</option>';
    
    // Also add the stable version itself as an option
    if (changelog[packageName][stableVersion]) {
        const stableDate = changelog[packageName][stableVersion]?.published_date;
        const dateStr = stableDate ? new Date(stableDate).toLocaleDateString() : '';
        optionsHtml += `<option value="${stableVersion}">${stableVersion} (Stable) ${dateStr ? '- ' + dateStr : ''}</option>`;
        
        if (prereleaseVersions.length > 0) {
            optionsHtml += `<option disabled>──────────</option>`;
        }
    }
    
    // Add pre-release versions
    prereleaseVersions.forEach(version => {
        const date = changelog[packageName][version]?.published_date;
        const dateStr = date ? new Date(date).toLocaleDateString() : '';
        optionsHtml += `<option value="${version}">${version} ${dateStr ? '- ' + dateStr : ''}</option>`;
    });
    
    versionSelect.innerHTML = optionsHtml;
    versionSelect.disabled = false;
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
const findLatestPackageVersion = (changelog, packageName) => {
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
const getEffectiveVersion = (changelog, packageName, requestedVersion) => {
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
const determinePackageStatus = (versionA, versionB, dataA, dataB) => {
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
const createPackageComparisonRow = (packageName, versionA, versionB, statusInfo) => {
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
const getPackageVersion = (packageName, alongWithData, changelog) => {
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
const calculateComparisonStats = (packages) => {
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
const buildPackagesList = (mainPackage, effectiveVersionA, effectiveVersionB, pkgDataA, pkgDataB, changelogA, changelogB) => {
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
const generatePackageComparisonData = (packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
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

/**
 * UI LAYER: Compare and display specific package versions
 * @param {string} packageName - Package to compare
 * @param {string} versionASpecific - Specific version in base
 * @param {string} versionBSpecific - Specific version in target
 * @param {Object} changelogA - Changelog for base stable version
 * @param {Object} changelogB - Changelog for target stable version
 */
const compareSpecificPackageVersions = (packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
    try {
        // Generate comparison data (pure data logic)
        const comparisonData = generatePackageComparisonData(
            packageName, 
            versionASpecific, 
            versionBSpecific, 
            changelogA, 
            changelogB
        );
        
        console.log('comparisonData', comparisonData);
        
        // Validate DOM elements
        if (!comparisonResults) {
            console.error('comparison-results element not found');
            return;
        }
        
        if (!comparisonTemplateElement) {
            console.error('comparison-template not found');
            return;
        }
        
        // Render template
        const template = Handlebars.compile(comparisonTemplateElement.innerHTML);
        const html = template(comparisonData);
        
        // Update DOM
        comparisonResults.innerHTML = html;
        comparisonResults.classList.remove('hide');
        
        // Update URL for sharing
        updateEnhancedComparisonURL(
            versionASelect.value,
            versionBSelect.value,
            packageName,
            comparisonData.versionA,
            comparisonData.versionB
        );
        
        // Show copy link button and helper
        if (copyComparisonLinkBtn) copyComparisonLinkBtn.classList.remove('hide');
        if (comparisonHelper) comparisonHelper.classList.remove('hide');
        
        // Scroll to results
        setTimeout(() => {
            comparisonResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        
    } catch (error) {
        console.error('Error in package comparison:', error);
        
        // Show error to user
        if (error.message.includes('Could not find version data')) {
            alert(error.message);
        } else {
            showComparisonError(error);
        }
    }
};

/**
 * Update URL with enhanced comparison parameters
 */
const updateEnhancedComparisonURL = (stableA, stableB, packageName, versionA, versionB) => {
    const url = new URL(window.location);
    
    // Clear old parameters
    url.searchParams.delete('stable_version');
    url.searchParams.delete('package');
    url.searchParams.delete('version');
    url.searchParams.delete('commitMessage');
    url.searchParams.delete('commitHash');
    url.searchParams.delete('compare');
    
    // Set new comparison parameters
    url.searchParams.set('compareStableA', stableA);
    url.searchParams.set('compareStableB', stableB);
    url.searchParams.set('comparePackage', packageName);
    url.searchParams.set('compareVersionA', versionA);
    url.searchParams.set('compareVersionB', versionB);
    
    window.history.pushState({}, '', url);
};

/**
 * Handle URL parameters for enhanced comparison
 */
const handleEnhancedComparisonURL = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    const stableA = urlParams.get('compareStableA');
    const stableB = urlParams.get('compareStableB');
    const packageName = urlParams.get('comparePackage');
    const versionA = urlParams.get('compareVersionA');
    const versionB = urlParams.get('compareVersionB');
    
    if (stableA && stableB && packageName && versionA && versionB) {
        return { stableA, stableB, packageName, versionA, versionB, shouldCompare: true };
    }
    
    return { shouldCompare: false };
};

/**
 * State Management - Cached changelogs and current selections
 */
const comparisonState = {
    cachedChangelogA: null,
    cachedChangelogB: null,
    currentStableA: null,
    currentStableB: null,
    
    reset() {
        this.cachedChangelogA = null;
        this.cachedChangelogB = null;
        this.currentStableA = null;
        this.currentStableB = null;
    },
    
    update(changelogA, changelogB, stableA, stableB) {
        this.cachedChangelogA = changelogA;
        this.cachedChangelogB = changelogB;
        this.currentStableA = stableA;
        this.currentStableB = stableB;
    }
};

/**
 * Populate version dropdowns for comparison mode
 */
const populateComparisonVersions = () => {
    if (versionSelectDropdown && versionSelectDropdown.innerHTML) {
        const options = versionSelectDropdown.innerHTML;
        if (versionASelect) versionASelect.innerHTML = options;
        if (versionBSelect) versionBSelect.innerHTML = options;
    }
};

/**
 * Reset comparison form selections
 */
const resetComparisonSelections = () => {
    if (comparisonPackageSelect) comparisonPackageSelect.value = '';
    if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
    if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
    if (comparisonPackageRow) comparisonPackageRow.style.display = 'none';
    if (prereleaseRow) prereleaseRow.style.display = 'none';
};

/**
 * Clear all comparison form inputs and state
 */
const clearComparisonForm = () => {
    if (versionASelect) versionASelect.value = '';
    if (versionBSelect) versionBSelect.value = '';
    resetComparisonSelections();
    if (comparisonResults) comparisonResults.classList.add('hide');
    
    comparisonState.reset();
    
    if (copyComparisonLinkBtn) copyComparisonLinkBtn.classList.add('hide');
    if (comparisonHelper) comparisonHelper.classList.add('hide');
    if (compareButton) compareButton.disabled = false;
};

/**
 * Clear comparison URL parameters
 */
const clearComparisonURLParams = () => {
    const url = new URL(window.location);
    ['compare', 'versionA', 'versionB', 'compareStableA', 'compareStableB', 
     'comparePackage', 'compareVersionA', 'compareVersionB'].forEach(param => {
        url.searchParams.delete(param);
    });
    window.history.pushState({}, '', url);
};

/**
 * Check and update comparison button state based on form selections
 */
const updateCompareButtonState = () => {
    if (!compareButton) return;
    
    const selectedPackage = comparisonPackageSelect ? comparisonPackageSelect.value : null;
    const versionASpecific = versionAPrereleaseSelect ? versionAPrereleaseSelect.value : null;
    const versionBSpecific = versionBPrereleaseSelect ? versionBPrereleaseSelect.value : null;
    const prereleaseRowVisible = prereleaseRow && prereleaseRow.style.display !== 'none';
    
    if (selectedPackage) {
        // Package selected - require at least one pre-release version
        if (!prereleaseRowVisible || (!versionASpecific && !versionBSpecific)) {
            compareButton.disabled = true;
        } else {
            compareButton.disabled = false;
        }
    } else {
        // No package selected - enable for full version comparison
        compareButton.disabled = false;
    }
};

/**
 * Update pre-release row labels with version numbers
 */
const updatePrereleaseLabels = () => {
    if (!prereleaseRow) return;
    
    const labelA = prereleaseRow.querySelector('label[for="version-a-prerelease-select"]');
    const labelB = prereleaseRow.querySelector('label[for="version-b-prerelease-select"]');
    if (labelA) labelA.textContent = `Pre-release Version for Base (${comparisonState.currentStableA}):`;
    if (labelB) labelB.textContent = `Pre-release Version for Target (${comparisonState.currentStableB}):`;
};

/**
 * Handle stable version changes - fetch changelogs and populate packages
 */
const handleStableVersionChange = async () => {
    const stableA = versionASelect.value;
    const stableB = versionBSelect.value;
    
    resetComparisonSelections();
    updateCompareButtonState();
    
    if (stableA && stableB && stableA !== stableB) {
        try {
            const [changelogA, changelogB] = await Promise.all([
                fetch(versionPaths[stableA]).then(res => res.json()),
                fetch(versionPaths[stableB]).then(res => res.json())
            ]);
            
            comparisonState.update(changelogA, changelogB, stableA, stableB);
            populateUnionPackages(changelogA, changelogB);
            updateCompareButtonState();
        } catch (error) {
            console.error('Error loading changelogs:', error);
            alert('Error loading version data. Please try again.');
        }
    }
};

/**
 * Handle package selection - populate pre-release versions
 */
const handlePackageChange = () => {
    const selectedPackage = comparisonPackageSelect.value;
    
    if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
    if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
    
    if (selectedPackage && comparisonState.cachedChangelogA && comparisonState.cachedChangelogB) {
        populatePrereleaseVersions(
            selectedPackage, 
            comparisonState.cachedChangelogA, 
            'version-a-prerelease-select',
            comparisonState.currentStableA
        );
        populatePrereleaseVersions(
            selectedPackage, 
            comparisonState.cachedChangelogB, 
            'version-b-prerelease-select',
            comparisonState.currentStableB
        );
        
        if (prereleaseRow) {
            prereleaseRow.style.display = 'flex';
            updatePrereleaseLabels();
        }
    } else {
        if (prereleaseRow) prereleaseRow.style.display = 'none';
    }
    
    updateCompareButtonState();
};

/**
 * Switch to single view mode
 */
const switchToSingleViewMode = () => {
    comparisonMode = false;
    
    // Update button styles
    singleViewBtn.classList.add('active', 'btn-primary');
    singleViewBtn.classList.remove('btn-default');
    comparisonViewBtn.classList.remove('active', 'btn-primary');
    comparisonViewBtn.classList.add('btn-default');
    
    // Toggle visibility
    if (searchForm) searchForm.classList.remove('hide');
    if (comparisonForm) comparisonForm.classList.add('hide');
    if (comparisonResults) comparisonResults.classList.add('hide');
    if (searchResults) searchResults.classList.remove('hide');
    if (helperSection) helperSection.classList.remove('hide');
    
    clearComparisonURLParams();
};

/**
 * Switch to comparison view mode
 */
const switchToComparisonViewMode = () => {
    comparisonMode = true;
    
    // Update button styles
    comparisonViewBtn.classList.add('active', 'btn-primary');
    comparisonViewBtn.classList.remove('btn-default');
    singleViewBtn.classList.remove('active', 'btn-primary');
    singleViewBtn.classList.add('btn-default');
    
    // Toggle visibility
    if (searchForm) searchForm.classList.add('hide');
    if (comparisonForm) comparisonForm.classList.remove('hide');
    if (searchResults) searchResults.classList.add('hide');
    if (helperSection) helperSection.classList.add('hide');
    
    populateComparisonVersions();
};

/**
 * Validate comparison form inputs
 */
const validateComparisonInputs = (stableA, stableB, selectedPackage, versionASpecific, versionBSpecific) => {
    if (!stableA || !stableB) {
        alert('Please select both stable versions');
        return false;
    }
    
    if (stableA === stableB) {
        alert('Please select two different stable versions');
        return false;
    }
    
    if (selectedPackage && !versionASpecific && !versionBSpecific) {
        alert('Please select at least one pre-release version, or leave package empty for full version comparison');
        return false;
    }
    
    return true;
};

/**
 * Handle comparison form submission
 */
const handleComparisonSubmit = (event) => {
    event.preventDefault();
    
    const stableA = versionASelect.value;
    const stableB = versionBSelect.value;
    const selectedPackage = comparisonPackageSelect ? comparisonPackageSelect.value : null;
    const versionASpecific = versionAPrereleaseSelect ? versionAPrereleaseSelect.value : null;
    const versionBSpecific = versionBPrereleaseSelect ? versionBPrereleaseSelect.value : null;
    
    if (!validateComparisonInputs(stableA, stableB, selectedPackage, versionASpecific, versionBSpecific)) {
        return;
    }
    
    if (selectedPackage && (versionASpecific || versionBSpecific)) {
        // Package-level comparison
        const finalVersionA = versionASpecific || stableA;
        const finalVersionB = versionBSpecific || stableB;
        console.log('Comparing:', finalVersionA, 'vs', finalVersionB);
        
        compareSpecificPackageVersions(
            selectedPackage,
            finalVersionA,
            finalVersionB,
            comparisonState.cachedChangelogA,
            comparisonState.cachedChangelogB
        );
    } else {
        // Full version comparison
        performVersionComparison(stableA, stableB);
    }
    
    if (compareButton) compareButton.disabled = false;
};

/**
 * Handle clear button click
 */
const handleClearClick = () => {
    clearComparisonForm();
    clearComparisonURLParams();
};

/**
 * Setup event listeners for comparison mode
 */
const setupComparisonEventListeners = () => {
    // Mode toggle buttons
    if (singleViewBtn) {
        singleViewBtn.addEventListener('click', switchToSingleViewMode);
    }
    
    if (comparisonViewBtn) {
        comparisonViewBtn.addEventListener('click', switchToComparisonViewMode);
    }
    
    // Version and package selectors
    if (versionASelect) versionASelect.addEventListener('change', handleStableVersionChange);
    if (versionBSelect) versionBSelect.addEventListener('change', handleStableVersionChange);
    if (comparisonPackageSelect) comparisonPackageSelect.addEventListener('change', handlePackageChange);
    
    // Pre-release version selectors
    if (versionAPrereleaseSelect) versionAPrereleaseSelect.addEventListener('change', updateCompareButtonState);
    if (versionBPrereleaseSelect) versionBPrereleaseSelect.addEventListener('change', updateCompareButtonState);
    
    // Form actions
    if (comparisonForm) comparisonForm.addEventListener('submit', handleComparisonSubmit);
    if (clearComparisonButton) clearComparisonButton.addEventListener('click', handleClearClick);
    if (copyComparisonLinkBtn) copyComparisonLinkBtn.addEventListener('click', copyComparisonLink);
};

/**
 * Handle enhanced comparison URL parameters on page load
 */
const loadEnhancedComparisonFromURL = async (enhancedParams) => {
    switchToComparisonMode();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    versionASelect.value = enhancedParams.stableA;
    versionBSelect.value = enhancedParams.stableB;
    await handleStableVersionChange();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    comparisonPackageSelect.value = enhancedParams.packageName;
    handlePackageChange();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    versionAPrereleaseSelect.value = enhancedParams.versionA;
    versionBPrereleaseSelect.value = enhancedParams.versionB;
    
    compareSpecificPackageVersions(
        enhancedParams.packageName,
        enhancedParams.versionA,
        enhancedParams.versionB,
        comparisonState.cachedChangelogA,
        comparisonState.cachedChangelogB
    );
};

/**
 * Handle standard comparison URL parameters on page load
 */
const loadStandardComparisonFromURL = async (urlParams) => {
    switchToComparisonMode(urlParams.versionA, urlParams.versionB);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    performVersionComparison(urlParams.versionA, urlParams.versionB);
};

/**
 * Initialize comparison mode functionality (Refactored)
 */
const initializeComparisonMode = async () => {
    // Setup all event listeners
    setupComparisonEventListeners();
    
    // Check for URL parameters on page load
    const enhancedParams = await handleEnhancedComparisonURL();
    if (enhancedParams.shouldCompare) {
        await loadEnhancedComparisonFromURL(enhancedParams);
        return;
    }
    
    // Check for standard comparison URL
    const urlParams = await handleComparisonURLParams();
    if (urlParams.shouldCompare) {
        await loadStandardComparisonFromURL(urlParams);
    }
};

/**
 * Initialize application in correct order to prevent race conditions
 * This ensures versionPaths is populated before URL parameters are checked
 */
const initializeApplication = async () => {
    // Step 1: Load version paths first (critical for URL parameter handling!)
    await populateVersions();
    
    // Step 2: Then initialize comparison mode (which checks URL params)
    await initializeComparisonMode();
};

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM is already ready
    initializeApplication();
}