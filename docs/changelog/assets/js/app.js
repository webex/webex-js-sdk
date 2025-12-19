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

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
});//Used for: Conditional rendering like {{#if (gt commits.length 0)}}
//Purpose: Greater-than comparison in Handlebars templates.


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
    };//Extract all search parameters from the URL

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
//fetchChangelog('logs/v3_10_0.json')
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
        
        // Populate package comparison dropdowns
        populatePackageDropdownForComparison('pkg1-select');
        populatePackageDropdownForComparison('pkg2-select');
        
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
    //Create disable flags for all fields
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
//Search changelog by commit message or hash.(A single commit can appear in multiple package versions.)
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
                    resulting_commit_hash.add(...allHashes);
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
                            resulting_commit_hash.union(allHashes);
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
//If package selected → filter to that package
    if(package !== null && package?.trim() !== ""){
        drill_down = {
            [package]: drill_down[package]
        };
    }
//If version selected → filter to that version
    if(version !== null && version?.trim() !== ""){
        drill_down = drill_down[package][version] ? {
            [package]: {
                [version]: drill_down[package][version]
            }
        } : {};
    }
    else if(//If searching by commit → call doSearch_commit()
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
//Show/hide the commits section in version comparison.
const toggleCommits = () => {
    const commitsList = document.getElementById('commits-list');
    const toggleText = document.getElementById('toggle-commits-text');
    
    if (commitsList && toggleText) {
        if (commitsList.classList.contains('hide')) {
            commitsList.classList.remove('hide');
            toggleText.textContent = 'Hide Commits';
        } else {
            commitsList.classList.add('hide');
            toggleText.textContent = 'Show Commits';
        }
    }
}

/**
 * Copy comparison link to clipboard
 * Global function that can be called from HTML or JS
 */
const copyComparisonLink = () => {
    const currentURL = window.location.href;
    const copyLinkBtn = document.getElementById('copy-comparison-link');
    
    console.log('Copying URL:', currentURL);
      
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentURL)
            .then(() => {
                console.log('URL copied successfully via Clipboard API');
                showCopySuccess(copyLinkBtn);
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                // Fallback to old method
                fallbackCopyToClipboard(currentURL, copyLinkBtn);
            });
    } else {
        console.log('Clipboard API not available, using fallback');
        // Fallback for older browsers
        fallbackCopyToClipboard(currentURL, copyLinkBtn);
    }
}

/**
 * Show success feedback on copy button
 */
const showCopySuccess = (button) => {
    if (!button) return;
    
    const originalText = button.innerHTML;
    button.innerHTML = '✓ Link Copied!';
    button.style.backgroundColor = '#28a745';
    button.style.borderColor = '#28a745';
    
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
            console.log('URL copied successfully via fallback method');
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
    button.style.backgroundColor = '#dc3545';
    button.style.borderColor = '#dc3545';
    
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
   PACKAGE-LEVEL COMPARISON FUNCTIONALITY
   ============================================ */

/**
 * Populate package dropdown for comparison
 * @param {string} selectId - ID of the select element
 */
const populatePackageDropdownForComparison = (selectId) => {
    const selectElement = document.getElementById(selectId);
    
    if (!selectElement) {
        console.warn(`Package dropdown element '${selectId}' not found`);
        return;
    }
    
    const stableVersion = versionSelectDropdown.value;
    
    if (!stableVersion) {
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="">Select a stable version first</option>';
        console.log(`${selectId}: No stable version selected`);
        return;
    }
    
    if (!currentChangelog) {
        selectElement.disabled = true;
        selectElement.innerHTML = '<option value="">Loading packages...</option>';
        console.log(`${selectId}: Changelog not loaded yet for version ${stableVersion}`);
        return;
    }
    
    // Get all packages for selected stable version
    let packages = Object.keys(currentChangelog);
    console.log(`${selectId}: Populating with ${packages.length} packages for version ${stableVersion}`);
    
    // Prioritize certain packages
    let specialPackages = ['webex', '@webex/calling'];
    let filteredPackages = packages.filter(pkg => !specialPackages.includes(pkg));
    filteredPackages.sort();
    
    let sortedPackages = [...specialPackages.filter(pkg => packages.includes(pkg)), ...filteredPackages];
    
    let optionsHtml = '<option value="">Select package...</option>';
    sortedPackages.forEach(pkg => {
        optionsHtml += `<option value="${pkg}">${pkg}</option>`;
    });
    
    selectElement.innerHTML = optionsHtml;
    selectElement.disabled = false;
    console.log(`${selectId}: Successfully populated with packages`);
};

/**
 * Populate version dropdown for selected package
 * @param {string} packageName - Selected package name
 * @param {string} versionSelectId - ID of version select element
 */
const populatePackageVersionsForComparison = (packageName, versionSelectId) => {
    const versionSelect = document.getElementById(versionSelectId);
    
    if (!versionSelect) {
        console.warn(`Version select element '${versionSelectId}' not found`);
        return;
    }
    
    if (!packageName) {
        versionSelect.disabled = true;
        versionSelect.innerHTML = '<option value="">Select package first</option>';
        console.log(`${versionSelectId}: No package selected`);
        return;
    }
    
    if (!currentChangelog || !currentChangelog[packageName]) {
        versionSelect.disabled = true;
        versionSelect.innerHTML = '<option value="">Package data not found</option>';
        console.warn(`${versionSelectId}: No data found for package ${packageName}`);
        return;
    }
    
    // Get all versions for this package
    const versions = Object.keys(currentChangelog[packageName])
        .sort((a, b) => {
            // Sort by published_date (newest first)
            const dateA = currentChangelog[packageName][a].published_date || 0;
            const dateB = currentChangelog[packageName][b].published_date || 0;
            return dateB - dateA;
        });
    
    console.log(`${versionSelectId}: Populating ${versions.length} versions for package ${packageName}`);
    
    let optionsHtml = '<option value="">Select version...</option>';
    versions.forEach(version => {
        const date = currentChangelog[packageName][version].published_date;
        const dateStr = date ? new Date(date).toLocaleDateString() : '';
        optionsHtml += `<option value="${version}">${version} ${dateStr ? '(' + dateStr + ')' : ''}</option>`;
    });
    
    versionSelect.innerHTML = optionsHtml;
    versionSelect.disabled = false;
    console.log(`${versionSelectId}: Successfully populated with versions`);
};

/**
 * Check if compare button should be enabled
 */
const checkEnablePackageCompareButton = () => {
    const btn = document.getElementById('pkg-compare-btn');
    if (!btn) return;
    
    const pkg1 = document.getElementById('pkg1-select')?.value;
    const pkg1Ver = document.getElementById('pkg1-version-select')?.value;
    const pkg2 = document.getElementById('pkg2-select')?.value;
    const pkg2Ver = document.getElementById('pkg2-version-select')?.value;
    
    const isReady = !!(pkg1 && pkg1Ver && pkg2 && pkg2Ver);
    btn.disabled = !isReady;
    
    if (isReady) {
        console.log('Compare button enabled:', {pkg1: `${pkg1}@${pkg1Ver}`, pkg2: `${pkg2}@${pkg2Ver}`});
    }
};

/**
 * Compare two package versions
 */
const comparePackageVersions = () => {
    const pkg1Name = document.getElementById('pkg1-select').value;
    const pkg1Version = document.getElementById('pkg1-version-select').value;
    const pkg2Name = document.getElementById('pkg2-select').value;
    const pkg2Version = document.getElementById('pkg2-version-select').value;
    
    if (!pkg1Name || !pkg1Version || !pkg2Name || !pkg2Version) {
        alert('Please select both packages and their versions');
        return;
    }
    
    const pkg1Data = currentChangelog[pkg1Name]?.[pkg1Version];
    const pkg2Data = currentChangelog[pkg2Name]?.[pkg2Version];
    
    if (!pkg1Data || !pkg2Data) {
        alert('Could not find package data');
        return;
    }
    
    console.log('Comparing packages:', {
        pkg1: `${pkg1Name}@${pkg1Version}`,
        pkg2: `${pkg2Name}@${pkg2Version}`
    });
    
    // Prepare data for display
    const comparisonData = {
        package1: {
            name: pkg1Name,
            version: pkg1Version,
            published_date: pkg1Data.published_date,
            commitCount: Object.keys(pkg1Data.commits || {}).length,
            commits: Object.entries(pkg1Data.commits || {}).map(([hash, message]) => ({
                hash,
                message
            })),
            alongWith: pkg1Data.alongWith
        },
        package2: {
            name: pkg2Name,
            version: pkg2Version,
            published_date: pkg2Data.published_date,
            commitCount: Object.keys(pkg2Data.commits || {}).length,
            commits: Object.entries(pkg2Data.commits || {}).map(([hash, message]) => ({
                hash,
                message
            })),
            alongWith: pkg2Data.alongWith
        }
    };
    
    // Display comparison
    displayPackageComparison(comparisonData);
};

/**
 * Display package comparison results
 * @param {Object} comparisonData - Comparison data
 */
const displayPackageComparison = (comparisonData) => {
    const resultsDiv = document.getElementById('package-compare-results');
    if (!resultsDiv) {
        console.error('package-compare-results element not found');
        return;
    }
    
    const templateElement = document.getElementById('package-comparison-template');
    if (!templateElement) {
        console.error('package-comparison-template element not found');
        return;
    }
    
    const packageComparisonTemplate = Handlebars.compile(templateElement.innerHTML);
    
    try {
        const html = packageComparisonTemplate(comparisonData);
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hide');
        
        // Scroll to results
        setTimeout(() => {
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        
        console.log('Package comparison displayed successfully');
    } catch (error) {
        console.error('Error rendering package comparison template:', error);
        resultsDiv.innerHTML = `<div style="color: red; padding: 20px;">Error rendering comparison: ${error.message}</div>`;
    }
};

/**
 * Initialize package comparison functionality
 */
const initializePackageComparison = () => {
    console.log('Initializing package comparison...');
    
    // When stable version changes, populate package dropdowns
    if (versionSelectDropdown) {
        versionSelectDropdown.addEventListener('change', () => {
            populatePackageDropdownForComparison('pkg1-select');
            populatePackageDropdownForComparison('pkg2-select');
            // Reset version dropdowns
            const pkg1Ver = document.getElementById('pkg1-version-select');
            const pkg2Ver = document.getElementById('pkg2-version-select');
            if (pkg1Ver) {
                pkg1Ver.innerHTML = '<option value="">Select package first</option>';
                pkg1Ver.disabled = true;
            }
            if (pkg2Ver) {
                pkg2Ver.innerHTML = '<option value="">Select package first</option>';
                pkg2Ver.disabled = true;
            }
            checkEnablePackageCompareButton();
        });
    }
    
    // When package 1 changes, populate its versions
    const pkg1Select = document.getElementById('pkg1-select');
    if (pkg1Select) {
        pkg1Select.addEventListener('change', (e) => {
            populatePackageVersionsForComparison(e.target.value, 'pkg1-version-select');
            checkEnablePackageCompareButton();
        });
    }
    
    // When package 2 changes, populate its versions
    const pkg2Select = document.getElementById('pkg2-select');
    if (pkg2Select) {
        pkg2Select.addEventListener('change', (e) => {
            populatePackageVersionsForComparison(e.target.value, 'pkg2-version-select');
            checkEnablePackageCompareButton();
        });
    }
    
    // Enable button when both versions selected
    const pkg1VerSelect = document.getElementById('pkg1-version-select');
    const pkg2VerSelect = document.getElementById('pkg2-version-select');
    if (pkg1VerSelect) pkg1VerSelect.addEventListener('change', checkEnablePackageCompareButton);
    if (pkg2VerSelect) pkg2VerSelect.addEventListener('change', checkEnablePackageCompareButton);
    
    // Compare button
    const compareForm = document.getElementById('package-compare-form');
    if (compareForm) {
        compareForm.addEventListener('submit', (e) => {
            e.preventDefault();
            comparePackageVersions();
        });
    }
    
    // Clear button
    const clearBtn = document.getElementById('pkg-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const pkg1Select = document.getElementById('pkg1-select');
            const pkg2Select = document.getElementById('pkg2-select');
            const pkg1Ver = document.getElementById('pkg1-version-select');
            const pkg2Ver = document.getElementById('pkg2-version-select');
            const results = document.getElementById('package-compare-results');
            
            if (pkg1Select) pkg1Select.value = '';
            if (pkg2Select) pkg2Select.value = '';
            if (pkg1Ver) {
                pkg1Ver.value = '';
                pkg1Ver.disabled = true;
                pkg1Ver.innerHTML = '<option value="">Select package first</option>';
            }
            if (pkg2Ver) {
                pkg2Ver.value = '';
                pkg2Ver.disabled = true;
                pkg2Ver.innerHTML = '<option value="">Select package first</option>';
            }
            if (results) results.classList.add('hide');
            
            checkEnablePackageCompareButton();
        });
    }
    
    console.log('Package comparison initialized');
};

// Initialize package comparison when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePackageComparison);
} else {
    initializePackageComparison();
}

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
    
    for (const packageName in changelog) {
        if (!changelog.hasOwnProperty(packageName)) continue;
        
        const packageVersions = changelog[packageName];
        const versionKeys = Object.keys(packageVersions);
        
        if (versionKeys.length === 0) continue;
        
        let selectedVersion = null;
        
        // Check if user specified a specific version for this package
        if (specificVersions && specificVersions[packageName]) {
            const requestedVersion = specificVersions[packageName];
            if (packageVersions[requestedVersion]) {
                selectedVersion = requestedVersion;
                console.log(`Using specific version for ${packageName}: ${requestedVersion}`);
            } else {
                console.warn(`Requested version ${requestedVersion} not found for ${packageName}, using latest`);
            }
        }
        
        // If no specific version requested or not found, use latest
        if (!selectedVersion) {
            let latestVersion = versionKeys[0];
            let latestDate = packageVersions[versionKeys[0]].published_date || 0;
            
            versionKeys.forEach(version => {
                const publishedDate = packageVersions[version].published_date || 0;
                if (publishedDate > latestDate) {
                    latestDate = publishedDate;
                    latestVersion = version;
                }
            });
            
            selectedVersion = latestVersion;
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
const comparePackages = (packagesA, packagesB, changelogA, changelogB) => {
    const allPackageNames = new Set([
        ...Object.keys(packagesA),
        ...Object.keys(packagesB)
    ]);
    
    const packages = [];
    const allCommits = new Map(); // hash -> {message, packages: Set()}
    let changedCount = 0;
    let unchangedCount = 0;
    let onlyInACount = 0;
    let onlyInBCount = 0;
    
    allPackageNames.forEach(packageName => {
        const versionA = packagesA[packageName];
        const versionB = packagesB[packageName];
        
        let status, changeClass;
        
        if (versionA && versionB) {
            if (versionA === versionB) {
                status = 'Unchanged';
                changeClass = 'unchanged';
                unchangedCount++;
            } else {
                status = 'Version Changed';
                changeClass = 'version-changed';
                changedCount++;
                
                // Collect commits from version B for changed packages
                if (changelogB[packageName] && changelogB[packageName][versionB]) {
                    const commits = changelogB[packageName][versionB].commits || {};
                    Object.entries(commits).forEach(([hash, message]) => {
                        if (!allCommits.has(hash)) {
                            allCommits.set(hash, {
                                message,
                                packages: new Set()
                            });
                        }
                        allCommits.get(hash).packages.add(packageName);
                    });
                }
            }
        } else if (versionA && !versionB) {
            status = 'Removed';
            changeClass = 'only-in-a';
            onlyInACount++;
        } else if (!versionA && versionB) {
            status = 'Added';
            changeClass = 'only-in-b';
            onlyInBCount++;
            
            // Collect commits from newly added packages
            if (changelogB[packageName] && changelogB[packageName][versionB]) {
                const commits = changelogB[packageName][versionB].commits || {};
                Object.entries(commits).forEach(([hash, message]) => {
                    if (!allCommits.has(hash)) {
                        allCommits.set(hash, {
                            message,
                            packages: new Set()
                        });
                    }
                    allCommits.get(hash).packages.add(packageName);
                });
            }
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
    
    // Convert commits Map to array for template
    const commitsList = Array.from(allCommits.entries()).map(([hash, data]) => ({
        hash,
        message: data.message,
        packageCount: data.packages.size,
        packages: Array.from(data.packages).sort()
    }));
    
    console.log(`Collected ${commitsList.length} unique commits`);
    
    return {
        packages,
        commits: commitsList,
        totalPackages: allPackageNames.size,
        totalCommits: commitsList.length,
        changedCount,
        unchangedCount,
        onlyInACount,
        onlyInBCount
    };
};

/**
 * Populate package dropdowns for comparison mode when version is selected
 * @param {string} versionSelectId - ID of the version select element
 * @param {string} packageSelectId - ID of the package select element
 */
const populateComparisonPackageDropdown = async (versionSelectId, packageSelectId) => {
    const versionSelect = document.getElementById(versionSelectId);
    const packageSelect = document.getElementById(packageSelectId);
    
    if (!versionSelect || !packageSelect) return;
    
    const selectedVersion = versionSelect.value;
    
    if (!selectedVersion) {
        packageSelect.innerHTML = '<option value="" disabled>First select a version</option>';
        packageSelect.disabled = true;
        return;
    }
    
    try {
        // Show loading state
        packageSelect.innerHTML = '<option value="" disabled>Loading packages...</option>';
        packageSelect.disabled = true;
        
        // Fetch changelog for the selected version
        const versionPath = versionPaths[selectedVersion];
        if (!versionPath) {
            throw new Error(`No path found for version ${selectedVersion}`);
        }
        
        const response = await fetch(versionPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch changelog for ${selectedVersion}`);
        }
        
        const changelog = await response.json();
        
        // Extract all package names
        const packages = Object.keys(changelog).sort();
        
        // Populate dropdown
        packageSelect.innerHTML = '<option value="">All packages (default)</option>';
        packages.forEach(pkg => {
            const option = document.createElement('option');
            option.value = pkg;
            option.textContent = pkg;
            packageSelect.appendChild(option);
        });
        
        packageSelect.disabled = false;
        
        console.log(`Populated ${packages.length} packages for ${selectedVersion}`);
        
    } catch (error) {
        console.error('Error populating package dropdown:', error);
        packageSelect.innerHTML = '<option value="" disabled>Error loading packages</option>';
    }
};

/**
 * Filter packages based on user selection
 * @param {Object} packages - All packages map
 * @param {Array} selectedPackages - Array of selected package names
 * @returns {Object} - Filtered packages map
 */
const filterSelectedPackages = (packages, selectedPackages) => {
    if (!selectedPackages || selectedPackages.length === 0) {
        return packages; // Return all if none selected
    }
    
    const filtered = {};
    selectedPackages.forEach(pkgName => {
        if (packages[pkgName]) {
            filtered[pkgName] = packages[pkgName];
        }
    });
    
    return filtered;
};

/**
 * Get selected packages from a multi-select dropdown
 * @param {string} selectId - ID of the select element
 * @returns {Array} - Array of selected package names
 */
const getSelectedPackages = (selectId) => {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return [];
    
    const selected = [];
    for (let option of selectElement.options) {
        if (option.selected && option.value) {
            selected.push(option.value);
        }
    }
    
    return selected;
};

/**
 * Populate package version dropdowns for selected packages
 * @param {string} sdkVersion - SDK version to fetch changelog from
 * @param {Array} selectedPackages - Array of selected package names
 * @param {string} containerId - ID of the container to populate
 * @param {string} prefix - Prefix for dropdown IDs ('a' or 'b')
 */
const populatePackageVersionDropdowns = async (sdkVersion, selectedPackages, containerId, prefix) => {
    const container = document.getElementById(containerId);
    const versionsContainer = document.getElementById('package-versions-container');
    
    if (!container || !sdkVersion || !selectedPackages || selectedPackages.length === 0) {
        if (container) container.innerHTML = '';
        if (versionsContainer && !document.getElementById('package-versions-a-container').innerHTML && 
            !document.getElementById('package-versions-b-container').innerHTML) {
            versionsContainer.classList.add('hide');
        }
        return;
    }
    
    try {
        // Show the versions container
        if (versionsContainer) versionsContainer.classList.remove('hide');
        
        // Show loading state
        container.innerHTML = '<p style="color: #666; font-size: 13px;">Loading package versions...</p>';
        
        // Fetch changelog for the selected SDK version
        const versionPath = versionPaths[sdkVersion];
        if (!versionPath) {
            throw new Error(`No path found for version ${sdkVersion}`);
        }
        
        const response = await fetch(versionPath);
        if (!response.ok) {
            throw new Error(`Failed to fetch changelog for ${sdkVersion}`);
        }
        
        const changelog = await response.json();
        
        // Clear container
        container.innerHTML = '';
        
        // Create dropdown for each selected package
        selectedPackages.forEach(packageName => {
            if (!changelog[packageName]) {
                console.warn(`Package ${packageName} not found in ${sdkVersion}`);
                return;
            }
            
            const packageVersions = Object.keys(changelog[packageName]).sort((a, b) => {
                // Sort by published date (newest first)
                const dateA = changelog[packageName][a].published_date || 0;
                const dateB = changelog[packageName][b].published_date || 0;
                return dateB - dateA;
            });
            
            // Create package version item
            const itemDiv = document.createElement('div');
            itemDiv.className = 'package-version-item';
            
            const label = document.createElement('label');
            label.textContent = packageName;
            label.htmlFor = `pkg-version-${prefix}-${packageName.replace(/[@\/]/g, '-')}`;
            
            const select = document.createElement('select');
            select.id = `pkg-version-${prefix}-${packageName.replace(/[@\/]/g, '-')}`;
            select.className = 'package-version-select';
            select.dataset.packageName = packageName;
            
            // Add "Latest" option
            const latestOption = document.createElement('option');
            latestOption.value = '';
            latestOption.textContent = 'Latest version (default)';
            select.appendChild(latestOption);
            
            // Add all versions
            packageVersions.forEach(version => {
                const option = document.createElement('option');
                option.value = version;
                option.textContent = version;
                select.appendChild(option);
            });
            
            itemDiv.appendChild(label);
            itemDiv.appendChild(select);
            container.appendChild(itemDiv);
        });
        
        console.log(`Populated version dropdowns for ${selectedPackages.length} packages in ${sdkVersion}`);
        
    } catch (error) {
        console.error('Error populating package version dropdowns:', error);
        container.innerHTML = '<p style="color: red; font-size: 13px;">Error loading package versions</p>';
    }
};

/**
 * Get selected package versions from version dropdowns
 * @param {string} containerId - ID of the container with version dropdowns
 * @returns {Object} - Map of {packageName: selectedVersion}
 */
const getSelectedPackageVersions = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return {};
    
    const versionMap = {};
    const selects = container.querySelectorAll('.package-version-select');
    
    selects.forEach(select => {
        const packageName = select.dataset.packageName;
        const selectedVersion = select.value; // Empty string means use latest
        if (packageName) {
            versionMap[packageName] = selectedVersion || null; // null means use latest
        }
    });
    
    return versionMap;
};

/**
 * Perform version comparison
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 */
const performVersionComparison = async (versionA, versionB) => {
    try {
        console.log('Starting comparison:', versionA, 'vs', versionB);
        console.log('Version paths:', versionPaths);
        
        const comparisonResults = document.getElementById('comparison-results');
        comparisonResults.innerHTML = '<p style="text-align: center; padding: 20px;">Loading comparison...</p>';
        comparisonResults.classList.remove('hide');
        
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
        
        console.log('Changelogs fetched successfully');
        console.log('Changelog A packages:', Object.keys(changelogA).length);
        console.log('Changelog B packages:', Object.keys(changelogB).length);
        
        // Get user-selected specific package versions
        const specificVersionsA = getSelectedPackageVersions('package-versions-a-container');
        const specificVersionsB = getSelectedPackageVersions('package-versions-b-container');
        
        console.log('Specific versions A:', specificVersionsA);
        console.log('Specific versions B:', specificVersionsB);
        
        // Extract and compare packages (with specific versions if selected)
        let packagesA = extractPackagesFromVersion(changelogA, specificVersionsA);
        let packagesB = extractPackagesFromVersion(changelogB, specificVersionsB);
        
        // Filter packages based on user selection
        const selectedPackagesA = getSelectedPackages('packages-a-select');
        const selectedPackagesB = getSelectedPackages('packages-b-select');
        
        if (selectedPackagesA.length > 0 || selectedPackagesB.length > 0) {
            console.log('Filtering packages...');
            console.log('Selected from A:', selectedPackagesA);
            console.log('Selected from B:', selectedPackagesB);
            
            // Get union of selected packages from both versions
            const allSelectedPackages = new Set([...selectedPackagesA, ...selectedPackagesB]);
            const selectedArray = Array.from(allSelectedPackages);
            
            packagesA = filterSelectedPackages(packagesA, selectedArray);
            packagesB = filterSelectedPackages(packagesB, selectedArray);
            
            console.log('Filtered to', selectedArray.length, 'packages');
        }
        
        console.log('Extracted packages A:', Object.keys(packagesA).length);
        console.log('Extracted packages B:', Object.keys(packagesB).length);
        
        const comparisonData = comparePackages(packagesA, packagesB, changelogA, changelogB);
        
        console.log('Comparison data:', comparisonData);
        console.log('Total packages in comparison:', comparisonData.packages?.length || 0);
        console.log('Total commits collected:', comparisonData.totalCommits || 0);
        
        // Render results
        displayComparison(versionA, versionB, comparisonData);
        
    } catch (error) {
        console.error('Error performing version comparison:', error);
        console.error('Error stack:', error.stack);
        document.getElementById('comparison-results').innerHTML = 
            `<div style="color: red; padding: 20px; background: #fee; border-radius: 5px;">
                <strong>Error:</strong> Failed to compare versions. ${error.message}
                <br><br><small>Check browser console for details (F12)</small>
            </div>`;
    }
};

/**
 * Display comparison results
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 * @param {Object} comparisonData - Comparison results
 */
const displayComparison = (versionA, versionB, comparisonData) => {
    console.log('Displaying comparison with data:', {
        versionA,
        versionB,
        packageCount: comparisonData.packages?.length,
        totalPackages: comparisonData.totalPackages,
        changedCount: comparisonData.changedCount
    });
    
    const comparisonResults = document.getElementById('comparison-results');
    
    if (!comparisonResults) {
        console.error('comparison-results element not found!');
        return;
    }
    
    const templateElement = document.getElementById('comparison-template');
    if (!templateElement) {
        console.error('comparison-template element not found!');
        return;
    }
    
    const comparisonTemplate = Handlebars.compile(templateElement.innerHTML);
    
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
        const copyLinkBtn = document.getElementById('copy-comparison-link');
        const helperText = document.getElementById('comparison-helper');
        if (copyLinkBtn) {
            copyLinkBtn.classList.remove('hide');
            console.log('Copy link button shown');
        } else {
            console.warn('Copy link button not found in DOM');
        }
        if (helperText) {
            helperText.classList.remove('hide');
        }
        
        // Scroll to results smoothly
        setTimeout(() => {
            comparisonResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        
        console.log('Comparison displayed successfully');
    } catch (error) {
        console.error('Error rendering template:', error);
        comparisonResults.innerHTML = `<div style="color: red; padding: 20px;">Error rendering comparison: ${error.message}</div>`;
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
    const singleViewBtn = document.getElementById('single-view-btn');
    const comparisonViewBtn = document.getElementById('comparison-view-btn');
    const searchForm = document.getElementById('search-form');
    const comparisonForm = document.getElementById('comparison-form');
    const searchResults = document.getElementById('search-results');
    
    const versionASelect = document.getElementById('version-a-select');
    const versionBSelect = document.getElementById('version-b-select');
    
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

/**
 * Initialize comparison mode functionality
 */
const initializeComparisonMode = async () => {
    const singleViewBtn = document.getElementById('single-view-btn');
    const comparisonViewBtn = document.getElementById('comparison-view-btn');
    const searchForm = document.getElementById('search-form');
    const comparisonForm = document.getElementById('comparison-form');
    const comparisonResults = document.getElementById('comparison-results');
    const searchResults = document.getElementById('search-results');
    
    const versionASelect = document.getElementById('version-a-select');
    const versionBSelect = document.getElementById('version-b-select');
    
    // Populate version dropdowns for comparison
    const populateComparisonVersions = () => {
        if (versionSelectDropdown && versionSelectDropdown.innerHTML) {
            const options = versionSelectDropdown.innerHTML;
            if (versionASelect) versionASelect.innerHTML = options;
            if (versionBSelect) versionBSelect.innerHTML = options;
        }
    };
    
    // Add event listeners for version selection to populate package dropdowns
    if (versionASelect) {
        versionASelect.addEventListener('change', () => {
            populateComparisonPackageDropdown('version-a-select', 'packages-a-select');
            // Clear version dropdowns when SDK version changes
            const containerA = document.getElementById('package-versions-a-container');
            if (containerA) containerA.innerHTML = '';
        });
    }
    
    if (versionBSelect) {
        versionBSelect.addEventListener('change', () => {
            populateComparisonPackageDropdown('version-b-select', 'packages-b-select');
            // Clear version dropdowns when SDK version changes
            const containerB = document.getElementById('package-versions-b-container');
            if (containerB) containerB.innerHTML = '';
        });
    }
    
    // Add event listeners for package selection to populate version dropdowns
    const packagesASelect = document.getElementById('packages-a-select');
    const packagesBSelect = document.getElementById('packages-b-select');
    
    if (packagesASelect) {
        packagesASelect.addEventListener('change', () => {
            const selectedPackages = getSelectedPackages('packages-a-select');
            const sdkVersion = versionASelect ? versionASelect.value : null;
            populatePackageVersionDropdowns(sdkVersion, selectedPackages, 'package-versions-a-container', 'a');
        });
    }
    
    if (packagesBSelect) {
        packagesBSelect.addEventListener('change', () => {
            const selectedPackages = getSelectedPackages('packages-b-select');
            const sdkVersion = versionBSelect ? versionBSelect.value : null;
            populatePackageVersionDropdowns(sdkVersion, selectedPackages, 'package-versions-b-container', 'b');
        });
    }
    
    // Single view mode
    if (singleViewBtn) {
        singleViewBtn.addEventListener('click', () => {
            comparisonMode = false;
            singleViewBtn.classList.add('active', 'btn-primary');
            singleViewBtn.classList.remove('btn-default');
            comparisonViewBtn.classList.remove('active', 'btn-primary');
            comparisonViewBtn.classList.add('btn-default');
            
            if (searchForm) searchForm.classList.remove('hide');
            if (comparisonForm) comparisonForm.classList.add('hide');
            if (comparisonResults) comparisonResults.classList.add('hide');
            if (searchResults) searchResults.classList.remove('hide');
            
            // Clear comparison URL parameters
            const url = new URL(window.location);
            url.searchParams.delete('compare');
            url.searchParams.delete('versionA');
            url.searchParams.delete('versionB');
            window.history.pushState({}, '', url);
        });
    }
    
    // Comparison view mode
    if (comparisonViewBtn) {
        comparisonViewBtn.addEventListener('click', () => {
            comparisonMode = true;
            comparisonViewBtn.classList.add('active', 'btn-primary');
            comparisonViewBtn.classList.remove('btn-default');
            singleViewBtn.classList.remove('active', 'btn-primary');
            singleViewBtn.classList.add('btn-default');
            
            if (searchForm) searchForm.classList.add('hide');
            if (comparisonForm) comparisonForm.classList.remove('hide');
            if (searchResults) searchResults.classList.add('hide');
            
            populateComparisonVersions();
        });
    }
    
    // Comparison form submit
    if (comparisonForm) {
        comparisonForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const versionA = versionASelect.value;
            const versionB = versionBSelect.value;
            
            if (!versionA || !versionB) {
                alert('Please select both versions to compare');
                return;
            }
            
            if (versionA === versionB) {
                alert('Please select two different versions');
                return;
            }
            
            performVersionComparison(versionA, versionB);
        });
    }
    
    // Clear button
    const clearBtn = document.getElementById('clear-comparison-button');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (versionASelect) versionASelect.value = '';
            if (versionBSelect) versionBSelect.value = '';
            if (comparisonResults) comparisonResults.classList.add('hide');
            
            // Clear package dropdowns
            const packagesASelect = document.getElementById('packages-a-select');
            const packagesBSelect = document.getElementById('packages-b-select');
            if (packagesASelect) {
                packagesASelect.innerHTML = '<option value="" disabled>First select Version A</option>';
                packagesASelect.disabled = true;
            }
            if (packagesBSelect) {
                packagesBSelect.innerHTML = '<option value="" disabled>First select Version B</option>';
                packagesBSelect.disabled = true;
            }
            
            // Clear package version dropdowns
            const versionContainerA = document.getElementById('package-versions-a-container');
            const versionContainerB = document.getElementById('package-versions-b-container');
            const versionsContainer = document.getElementById('package-versions-container');
            if (versionContainerA) versionContainerA.innerHTML = '';
            if (versionContainerB) versionContainerB.innerHTML = '';
            if (versionsContainer) versionsContainer.classList.add('hide');
            
            // Hide copy link button and helper
            const copyLinkBtn = document.getElementById('copy-comparison-link');
            const helperText = document.getElementById('comparison-helper');
            if (copyLinkBtn) copyLinkBtn.classList.add('hide');
            if (helperText) helperText.classList.add('hide');
            
            // Clear URL parameters
            const url = new URL(window.location);
            url.searchParams.delete('compare');
            url.searchParams.delete('versionA');
            url.searchParams.delete('versionB');
            window.history.pushState({}, '', url);
        });
    }
    
    // Copy comparison link button - backup event listener
    // (Primary method is onclick in HTML, this is a fallback)
    const copyLinkBtn = document.getElementById('copy-comparison-link');
    if (copyLinkBtn) {
        // Remove any existing listeners and add new one
        copyLinkBtn.addEventListener('click', copyComparisonLink);
        console.log('Copy link button event listener attached');
    }
    
    // Check for comparison URL parameters on page load
    const urlComparisonParams = await handleComparisonURLParams();
    if (urlComparisonParams.shouldCompare) {
        // Switch to comparison mode and trigger comparison
        switchToComparisonMode(urlComparisonParams.versionA, urlComparisonParams.versionB);
        
        // Wait a bit for dropdowns to be populated
        setTimeout(() => {
            performVersionComparison(urlComparisonParams.versionA, urlComparisonParams.versionB);
        }, 300);
    }
};

// Wait for DOM to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeComparisonMode);
} else {
    // DOM is already ready
    initializeComparisonMode();
}