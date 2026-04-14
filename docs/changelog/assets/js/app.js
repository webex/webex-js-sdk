// Global variable to store the current changelog and version paths
let currentChangelog;
const versionPaths = {};
let comparisonMode = false;
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
    const escaped = string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    switch(type){
        case 'hash':
            return `<a href='${github_base_url}commit/${escaped}' target='_blank'>${escaped}</a>`;
        case 'message':
            return escaped.replace(/#(\d+)/g, `<a href="${github_base_url}pull/$1" target="_blank">#$1</a>`);
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
    if (versionSelectDropdown) {
        versionSelectDropdown.innerHTML = '<option value="">Loading versions...</option>';
        versionSelectDropdown.disabled = true;
    }
    try {
        const response = await fetch('logs/main.json');
        const data = await response.json();
        let optionsHtml = '<option value="">Select a version</option>'; // Placeholder option

        Object.entries(data).forEach(([version, path]) => {
            versionPaths[version] = path;
            optionsHtml += `<option value="${version}">${version}</option>`;
        });

        versionSelectDropdown.innerHTML = optionsHtml; // Set all options at once
        if (versionSelectDropdown) versionSelectDropdown.disabled = false;

        // Call populateFormFieldsFromURL on page load to populate fields based on URL parameters
        populateFormFieldsFromURL();
    } catch (error) {
        console.error('Error fetching version data:', error);
        if (versionSelectDropdown) {
            versionSelectDropdown.innerHTML = '<option value="">Error loading versions</option>';
            versionSelectDropdown.disabled = false;
        }
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
    let specialPackages = ['webex', '@webex/calling', '@webex/contact-center'];
    let filteredPackages = Object.keys(changelog).filter(pkg => !specialPackages.includes(pkg));

    // Sort the remaining packages alphabetically
    filteredPackages.sort();

    const existingSpecialPackages = specialPackages.filter(pkg => changelog[pkg]);
    let sortedPackages;
    if (existingSpecialPackages.length > 0) {
        sortedPackages = [...existingSpecialPackages, 'separator', ...filteredPackages];
    } else {
        sortedPackages = filteredPackages;
    }
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
 * Copy comparison link to clipboard.
 * Global function that can be called from HTML or JS.
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
 * Show success feedback on copy button.
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
 * Fallback copy method for browsers without Clipboard API (Older browsers don't support navigator.clipboard).
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
 * Show error feedback.
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

/* ============================================
   VERSION COMPARISON FUNCTIONALITY
   ============================================ */
/**
 * Show loading state for comparison.
 */
const showComparisonLoading = () => {
    if (!comparisonResults) return;
    comparisonResults.innerHTML = '<p style="text-align: center; padding: 20px;">Loading comparison...</p>';
    comparisonResults.classList.remove('hide');
};

/**
 * Show error state for comparison.
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
   ENHANCED VERSION COMPARISON HELPERS
   ============================================ */

/**
 * Get union of packages from both versions (all packages that exist in either version).
 * @param {Object} changelogA - Changelog data for version A
 * @param {Object} changelogB - Changelog data for version B
 * @returns {Array<string>} - Array of all package names (union)
 */
const getUnionPackages = (changelogA, changelogB) => {
    const packagesA = new Set(Object.keys(changelogA || {}));
    const packagesB = new Set(Object.keys(changelogB || {}));

    // Create union of both package sets
    const allPackages = new Set([...packagesA, ...packagesB]);

    // Prioritize certain packages
    const specialPackages = ['webex', '@webex/calling', '@webex/contact-center'];
    const filtered = [...allPackages].filter(pkg => !specialPackages.includes(pkg));
    filtered.sort();

    const presentSpecial = specialPackages.filter(pkg => allPackages.has(pkg));
    if (presentSpecial.length > 0 && filtered.length > 0) {
        return [...presentSpecial, 'separator', ...filtered];
    }
    return [...presentSpecial, ...filtered];
};

/**
 * Populate the package dropdown with union of packages from both versions.
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

    let optionsHtml = '<option value="">Select a package</option>';
    allPackages.forEach(pkg => {
        if (pkg === 'separator') {
            optionsHtml += '<option disabled>──────────</option>';
            return;
        }
        optionsHtml += `<option value="${pkg}">${pkg}</option>`;
    });

    comparisonPackageSelect.innerHTML = optionsHtml;
    comparisonPackageRow.style.display = 'flex';
};

/**
 * Populate pre-release versions for a selected package.
 * @param {string} packageName - Selected package name
 * @param {Object} changelog - Changelog data
 * @param {string} selectId - ID of the select element to populate
 * @param {string} stableVersion - The stable version (e.g., 3.3.1)
 * @param {boolean} [excludeStable=false] - When true, omit the stable entry from the dropdown
 */
const populatePrereleaseVersions = (packageName, changelog, selectId, stableVersion, excludeStable = false) => {
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
    if ( !excludeStable && changelog[packageName][stableVersion] ) {
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

/**
 * Find the latest version of a package in a changelog by published date.
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
 * Get effective version with fallback to latest if requested version doesn't exist.
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
 * Determine the comparison status between two package versions.
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
 * Create a package comparison row object.
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
 * Get package version from alongWith data or changelog.
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
 * Calculate comparison statistics from packages array.
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
 * Build complete packages list including main package and all related packages.
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
   COMMIT HISTORY — CROSS-STABLE COLLECTION
   Implements logic from normal-text.txt:
   Walk every stable version between stableA and stableB,
   open each log file, and collect commits per the rules below.
   ============================================ */

// Sort version strings like "3.6.0", "3.10.0", "3.8.1" by semver
const sortStableVersions = (versions) =>
    [...versions].sort((a, b) => {
        const p = v => v.split('.').map(Number);
        const [aMaj, aMin, aPatch] = p(a);
        const [bMaj, bMin, bPatch] = p(b);
        return aMaj !== bMaj ? aMaj - bMaj : aMin !== bMin ? aMin - bMin : aPatch - bPatch;
    });

// Get all stable versions (from versionPaths) that sit between stableA and stableB (inclusive)
const getStableVersionsBetween = (stableA, stableB) => {
    const all = sortStableVersions(Object.keys(versionPaths));
    const iA = all.indexOf(stableA), iB = all.indexOf(stableB);
    if (iA === -1 || iB === -1) return [];
    return all.slice(Math.min(iA, iB), Math.max(iA, iB) + 1);
};

// --- Regex helpers for pre-release version identification ---

// Is this version a pre-release of the given stable?
// e.g. isPreRelease("3.5.0-next.1", "3.5.0") → true
//      isPreRelease("3.5.0",         "3.5.0") → false
const isPreRelease = (version, stableVersion) =>
    version.startsWith(stableVersion + '-');

// Is this an exact stable version (no pre-release suffix)?
// e.g. isExactStable("3.6.0")        → true
//      isExactStable("3.6.0-next.1") → false
const isExactStable = (version) => /^\d+\.\d+\.\d+$/.test(version);

// Extract numeric suffix: "3.5.0-next.5" → 5,  "3.5.0-multipleLLM.3" → 3
const getPreReleaseNum = (version) => {
    const match = version.match(/-[a-zA-Z]+\.(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
};

// Extract tag name: "3.5.0-next.5" with stable "3.5.0" → "next"
//                   "3.5.0-multipleLLM.3"               → "multipleLLM"
const getPreReleaseTag = (version, stableVersion) => {
    return version.slice(stableVersion.length + 1).replace(/\.\d+$/, '');
};

/**
 * Collect commits from one stable version's package data — fully regex-based,
 * no dependency on published_date for version identification.
 *
 * Rules (from normal-text.txt):
 *  'start'  → from versionA (inclusive) through ALL remaining pre-releases
 *             Special: if versionA === stableVersion → only stable entry
 *  'middle' → skip exact stable entry; ALL pre-releases of this stable
 *  'end'    → ALL pre-releases from next.1 up to versionB (inclusive)
 *             Special: if versionB === stableVersion → only stable entry
 *  'only'   → stableA === stableB; from versionA to versionB within same file
 */
const collectCommitsFromStable = (packageData, stableVersion, versionA, versionB, position) => {
    if (!packageData) return [];
    const all = Object.keys(packageData);
    let versionsToUse = [];

    if (position === 'start') {
        if (versionA === stableVersion) {
            // versionA is the stable itself → include stable commits
            versionsToUse = [stableVersion];
        } else {
            const tagA = getPreReleaseTag(versionA, stableVersion);
            const numA = getPreReleaseNum(versionA);
            versionsToUse = all.filter(v => {
                if (!isPreRelease(v, stableVersion)) return false;
                const tag = getPreReleaseTag(v, stableVersion);
                const num = getPreReleaseNum(v);
                // Same tag (e.g. "next"): include if num >= numA
                // Different tag (e.g. "multipleLLM"): include all — alternate pre-release streams also ship in the final stable
                return tag === tagA ? num >= numA : true;
            });
        }

    } else if (position === 'middle') {
        // Take ALL pre-releases of this stable, skip exact stable entry
        versionsToUse = all.filter(v => isPreRelease(v, stableVersion));
    } else if (position === 'end') {
        if (versionB === stableVersion) {
            versionsToUse = [stableVersion];
        } else {
            const tagB = getPreReleaseTag(versionB, stableVersion);
            const numB = getPreReleaseNum(versionB);
            versionsToUse = all.filter(v => {
                if (!isPreRelease(v, stableVersion)) return false;
                const tag = getPreReleaseTag(v, stableVersion);
                const num = getPreReleaseNum(v);
                // Same tag: include if num <= numB
                // Different tag: include all - alternate pre-release streams also ship in the final stable
                return tag === tagB ? num <= numB : true;
            });
        }

    } else { // 'only' — stableA === stableB
        if (versionA === stableVersion && versionB === stableVersion) {
            versionsToUse = [stableVersion];
        } else if (versionA === stableVersion) {
            // from stable entry through pre-releases up to versionB
            const tagB = getPreReleaseTag(versionB, stableVersion);
            const numB = getPreReleaseNum(versionB);
            versionsToUse = all.filter(v => {
                if (v === stableVersion) return true;
                if (!isPreRelease(v, stableVersion)) return false;
                const tag = getPreReleaseTag(v, stableVersion);
                const num = getPreReleaseNum(v);
                // Same tag: include up to numB; different tag: include all (ships in final stable)
                return tag === tagB ? num <= numB : true;
            });
        } else {
            // Both are pre-releases within the same stable
            const tagA = getPreReleaseTag(versionA, stableVersion);
            const numA = getPreReleaseNum(versionA);
            const tagB = getPreReleaseTag(versionB, stableVersion);
            const numB = getPreReleaseNum(versionB);
            versionsToUse = all.filter(v => {
                if (!isPreRelease(v, stableVersion)) return false;
                const tag = getPreReleaseTag(v, stableVersion);
                const num = getPreReleaseNum(v);
                // Same tag: apply range bounds; different tag: include all (ships in final stable)
                const afterStart = tag === tagA ? num >= numA : true;
                const beforeEnd  = tag === tagB ? num <= numB : true;
                return afterStart && beforeEnd;
            });
        }
    }

    const seen = new Map();
    versionsToUse.forEach(ver => {
        Object.entries(packageData[ver]?.commits || {}).forEach(([hash, message]) => {
            if (!seen.has(hash)) {
                seen.set(hash, { hash, shortHash: hash.substring(0, 7), message,
                    url: `${github_base_url}commit/${hash}`, version: ver, stableGroup: stableVersion });
            }
        });
    });
    return Array.from(seen.values());
};

/**
 * Walk every stable version between stableA and stableB, fetch its log file,
 * Returns a flat, deduplicated array of commit objects.
 */
const collectCommitsAcrossStables = async (stableA, stableB, packageName, versionA, versionB, changelogA, changelogB) => {
    const stables = getStableVersionsBetween(stableA, stableB);
    if (stables.length === 0) return { commitsBetween: [], stableVersionsTraversed: [] };
   // Pre-fetch all intermediate changelogs in parallel
  const intermediateStables = stables.filter(s => s !== stableA && s !== stableB);
  const fetched = await Promise.all(
      intermediateStables.map(async (stable) => {
          try {
              const res = await fetch(versionPaths[stable]);
              return [stable, res.ok ? await res.json() : null];
          } catch {
              return [stable, null];
          }
      })
  );
  const changelogMap = new Map(fetched);


    const all = new Map();
    const traversed = [];

    for (let i = 0; i < stables.length; i++) {
        const stable = stables[i];
        let changelog;

        if (stable === stableA) {
            changelog = changelogA;
        } else if (stable === stableB) {
            changelog = changelogB;
        } else {
            changelog = changelogMap.get(stable);
            if (!changelog) continue;
        }

        const pkgData = changelog[packageName];
        if (!pkgData) continue;

        let position;
        if (stableA === stableB)       position = 'only';
        else if (stable === stableA)   position = 'start';
        else if (stable === stableB)   position = 'end';
        else                           position = 'middle';

        const commits = collectCommitsFromStable(pkgData, stable, versionA, versionB, position);
        if (commits.length > 0) {
            traversed.push(stable);
            commits.forEach(c => { if (!all.has(c.hash)) all.set(c.hash, c); });
        }
    }

    return { commitsBetween: Array.from(all.values()), stableVersionsTraversed: traversed };
};

/**
 * DATA LAYER: Generate package comparison data (async — fetches intermediate changelogs)
 * @param {string} stableA        - Base stable version (e.g. "3.6.0")
 * @param {string} stableB        - Target stable version (e.g. "3.10.0")
 * @param {string} packageName    - Package to compare
 * @param {string} versionASpecific - Specific pre-release in base (or stable)
 * @param {string} versionBSpecific - Specific pre-release in target (or stable)
 * @param {Object} changelogA     - Already-fetched changelog for stableA
 * @param {Object} changelogB     - Already-fetched changelog for stableB
 * @returns {Promise<Object>} Comparison data object
 */
const generatePackageComparisonData = async (stableA, stableB, packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
    // Step 1: Determine effective versions (with fallback to latest)
    const effectiveVersionA = getEffectiveVersion(changelogA, packageName, versionASpecific);
    const effectiveVersionB = getEffectiveVersion(changelogB, packageName, versionBSpecific);

    // Step 2: Get package data for the table
    const pkgDataA = changelogA[packageName]?.[effectiveVersionA];
    const pkgDataB = changelogB[packageName]?.[effectiveVersionB];

    if (!pkgDataA && !pkgDataB) {
        throw new Error('Could not find version data for comparison in either version');
    }

    // Step 3: Build package versions table
    const packages = buildPackagesList(packageName, effectiveVersionA, effectiveVersionB, pkgDataA, pkgDataB, changelogA, changelogB);
    const stats = calculateComparisonStats(packages);

    // Step 4: Collect commit history across all stable versions between stableA and stableB
    const { commitsBetween, stableVersionsTraversed } = await collectCommitsAcrossStables(
        stableA, stableB, packageName, effectiveVersionA, effectiveVersionB, changelogA, changelogB
    );

    return {
        versionA: effectiveVersionA,
        versionB: effectiveVersionB,
        packages,
        totalPackages: packages.length,
        packageName,
        commitsBetween,
        commitsBetweenCount: commitsBetween.length,
        hasCommitsBetween: commitsBetween.length > 0,
        stableVersionsTraversed,
        ...stats
    };
};

/**
 * UI LAYER: Compare and display specific package versions
 * @param {string} stableA - Base stable version
 * @param {string} stableB - Target stable version
 * @param {string} packageName - Package to compare
 * @param {string} versionASpecific - Specific version in base
 * @param {string} versionBSpecific - Specific version in target
 * @param {Object} changelogA - Changelog for base stable version
 * @param {Object} changelogB - Changelog for target stable version
 */
const compareSpecificPackageVersions = async (stableA, stableB, packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
    showComparisonLoading();
    try {
        // Generate comparison data (fetches intermediate changelogs as needed)
        const comparisonData = await generatePackageComparisonData(
            stableA,
            stableB,
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
 * Update URL with enhanced comparison parameters.
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
 * Handle URL parameters for enhanced comparison.
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
 * State Management - Cached changelogs and current selections.
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
 * Populate version dropdowns for comparison mode.
 */
const populateComparisonVersions = () => {
    if (versionSelectDropdown && versionSelectDropdown.innerHTML) {
        const options = versionSelectDropdown.innerHTML;
        if (versionASelect) {
            versionASelect.innerHTML = options; versionASelect.disabled = false;
        }
        if (versionBSelect) {
            versionBSelect.innerHTML = options; versionBSelect.disabled = false;
         }
    }
};

/**
 * Reset comparison form selections.
 */
const resetComparisonSelections = () => {
    if (comparisonPackageSelect) comparisonPackageSelect.value = '';
    if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
    if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
    if (comparisonPackageRow) comparisonPackageRow.style.display = 'none';
    if (prereleaseRow) prereleaseRow.style.display = 'none';
    if (copyComparisonLinkBtn) copyComparisonLinkBtn.classList.add('hide');
    if (comparisonHelper) comparisonHelper.classList.add('hide');
    if (comparisonResults) comparisonResults.classList.add('hide');
};

/**
 * Clear all comparison form inputs and state.
 */
const clearComparisonForm = () => {
    if (versionASelect) { versionASelect.value = ''; versionASelect.disabled = false; }
    if (versionBSelect) { versionBSelect.value = ''; versionBSelect.disabled = false; }
    resetComparisonSelections();
    if (comparisonResults) comparisonResults.classList.add('hide');

    comparisonState.reset();

    if (copyComparisonLinkBtn) copyComparisonLinkBtn.classList.add('hide');
    if (comparisonHelper) comparisonHelper.classList.add('hide');
    if (compareButton) compareButton.disabled = false;
};

/**
 * Clear comparison URL parameters.
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

    const stableA = versionASelect ? versionASelect.value : null;
    const stableB = versionBSelect ? versionBSelect.value : null;
    const selectedPackage = comparisonPackageSelect ? comparisonPackageSelect.value : null;
    const versionASpecific = versionAPrereleaseSelect ? versionAPrereleaseSelect.value : null;
    const versionBSpecific = versionBPrereleaseSelect ? versionBPrereleaseSelect.value : null;
    const prereleaseRowVisible = prereleaseRow && prereleaseRow.style.display !== 'none';

    if (stableA && stableB && stableA === stableB) {
        // Same stable: must select a package and both pre-release versions (and they must differ)
        const bothSelected = prereleaseRowVisible && versionASpecific && versionBSpecific;
        compareButton.disabled = !(selectedPackage && bothSelected && versionASpecific !== versionBSpecific);
    } else if (selectedPackage) {
        // Different stables, package selected — require at least one pre-release version
        if (!prereleaseRowVisible || (!versionASpecific && !versionBSpecific)) {
            compareButton.disabled = true;
        } else {
            compareButton.disabled = false;
        }
    } else {
        compareButton.disabled = true;
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
    clearComparisonURLParams();
    updateCompareButtonState();

    if (stableA && stableB) {
        try {
            let changelogA, changelogB;
            if (stableA === stableB) {
                // Same stable — fetch once and reuse for both sides
                changelogA = await fetch(versionPaths[stableA]).then(res =>{
                    if (!res.ok) throw new Error(`Failed to Fetch ${res.status}`);
                    return res.json();
                });

                changelogB = changelogA;
            } else {
                [changelogA, changelogB] = await Promise.all([
                    fetch(versionPaths[stableA]).then(res =>{
                        if (!res.ok) throw new Error(`Failed to Fetch ${res.status}`);
                        return res.json();
                    }),
                    fetch(versionPaths[stableB]).then(res =>{
                        if (!res.ok) throw new Error(`Failed to Fetch ${res.status}`);
                        return res.json();
                    })
                ]);
            }

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
            comparisonState.currentStableB,
            comparisonState.currentStableA === comparisonState.currentStableB
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
        // Same stable: must pick a package and two distinct pre-release versions
        if (!selectedPackage) {
            alert('When comparing within the same stable version, please select a package.');
            return false;
        }
        if (!versionASpecific || !versionBSpecific) {
            alert('When comparing within the same stable version, please select both pre-release versions.');
            return false;
        }
        if (versionASpecific === versionBSpecific) {
            alert('Please select two different versions to compare.');
            return false;
        }
        return true;
    }
    const allSorted = sortStableVersions([stableA, stableB]);
    if (allSorted[0] !== stableA) {
        alert(`Base version (${stableA}) must be older than target version (${stableB}). Please swap.`);
        return false;
    }

    // When both selected versions are exact stables (Example 5),
    // base stable must be SMALLER than target stable in semver order.
    // e.g. base=3.6.0 vs target=3.10.0 → OK
    //      base=3.10.0 vs target=3.6.0  → blocked
    const finalA = versionASpecific || stableA;
    const finalB = versionBSpecific || stableB;
    if (isExactStable(finalA) && isExactStable(finalB)) {
        const stables = sortStableVersions(Object.keys(versionPaths));
        const idxA = stables.indexOf(finalA);
        const idxB = stables.indexOf(finalB);
        if (idxA !== -1 && idxB !== -1 && idxA >= idxB) {
            alert(`Base version (${finalA}) must be older than target version (${finalB}).\nPlease swap the selections.`);
            return false;
        }
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

        compareSpecificPackageVersions(
            stableA,
            stableB,
            selectedPackage,
            finalVersionA,
            finalVersionB,
            comparisonState.cachedChangelogA,
            comparisonState.cachedChangelogB
        );
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
    switchToComparisonViewMode();
    if (versionASelect) versionASelect.value = enhancedParams.stableA;
    if (versionBSelect) versionBSelect.value = enhancedParams.stableB;
    await handleStableVersionChange();
    if (!comparisonState.cachedChangelogA || !comparisonState.cachedChangelogB) {
        console.error('Changelog not found');
        return;
     }
     // Validate version order for hand-crafted URLs
    if (enhancedParams.stableA !== enhancedParams.stableB) {
        const sorted = sortStableVersions([enhancedParams.stableA, enhancedParams.stableB]);
        if (sorted[0] !== enhancedParams.stableA) {
            console.error('Invalid URL: base version must be older than target version');
            return;
        }
    }

    if (comparisonPackageSelect) comparisonPackageSelect.value = enhancedParams.packageName;
    handlePackageChange();

    if(versionAPrereleaseSelect) versionAPrereleaseSelect.value = enhancedParams.versionA;
    if(versionBPrereleaseSelect) versionBPrereleaseSelect.value = enhancedParams.versionB;

    compareSpecificPackageVersions(
        enhancedParams.stableA,
        enhancedParams.stableB,
        enhancedParams.packageName,
        enhancedParams.versionA,
        enhancedParams.versionB,
        comparisonState.cachedChangelogA,
        comparisonState.cachedChangelogB
    );
};
/**
 * Initialize comparison mode functionality (Refactored)
 */
const initializeComparisonMode = async () => {
    // Setup all event listeners
    setupComparisonEventListeners();

    // Listen for browser navigation affecting comparison view
    window.addEventListener('popstate', async () => {
        const enhancedParams = await handleEnhancedComparisonURL();
        if (enhancedParams.shouldCompare) {
            await loadEnhancedComparisonFromURL(enhancedParams);
        } else {
            clearComparisonForm();
        }
    });

    // Check for URL parameters on page load
    const enhancedParams = await handleEnhancedComparisonURL();
    if (enhancedParams.shouldCompare) {
        await loadEnhancedComparisonFromURL(enhancedParams);
        return;
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

    // Step 3: Handle Back/Forward for single-version search.
    window.addEventListener('popstate', async () => {
        const urlParams = new URLSearchParams(window.location.search);

        // Comparison URLs are handled by the listener in initializeComparisonMode.
        if (urlParams.has('compareStableA')) return;

        const hasSingleSearchParams =
            urlParams.has('stable_version') ||
            urlParams.has('package') ||
            urlParams.has('version') ||
            urlParams.has('commitMessage') ||
            urlParams.has('commitHash');

        if (hasSingleSearchParams) {
            await populateFormFieldsFromURL();
        } else {
            versionSelectDropdown.value = '';
            packageNameInputDropdown.value = '';
            versionInput.value = '';
            commitMessageInput.value = '';
            commitHashInput.value = '';
            searchResults.innerHTML = '';
            searchResults.classList.add('hide');
            updateFormState({
                stable_version: '',
                package: '',
                version: '',
                commitMessage: '',
                commitHash: '',
            });
        }
    });
};

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM is already ready
    initializeApplication();
}