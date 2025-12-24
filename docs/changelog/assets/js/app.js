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
                    // Fix: Add each hash individually from allHashes Set
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
                            // Fix: Merge allHashes into resulting_commit_hash using forEach
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
      
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentURL)
            .then(() => {
                showCopySuccess(copyLinkBtn);
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopyToClipboard(currentURL, copyLinkBtn);
            });
    } else {
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
        ...Object.keys(packagesA),//ALL packages in version A
        ...Object.keys(packagesB)//ALL packages in version B
    ]);
    
    const packages = [];
    const allCommits = new Map(); // hash -> {message, packages: Set()}
    let changedCount = 0;
    let unchangedCount = 0;
    let onlyInACount = 0;
    let onlyInBCount = 0;
    
    allPackageNames.forEach(packageName => {
        const versionA = packagesA[packageName];
        const versionB = packagesB[packageName];//start iterating through all unique packages names
        
        let status, changeClass;//Declare variables for status label and CSS class
        
        if (versionA && versionB) {//checks if package is in both versions
            if (versionA === versionB) {//if versionA is the same as versionB, then it is unchanged
                status = 'Unchanged';
                changeClass = 'unchanged';
                unchangedCount++;
            } else {
                status = 'Version Changed';
                changeClass = 'version-changed';
                changedCount++;
                
                if (changelogA[packageName] && changelogA[packageName][versionA]) {
                    const commitsA = changelogA[packageName][versionA].commits || {};
                    Object.entries(commitsA).forEach(([hash, message]) => {
                        if (!allCommits.has(hash)) {
                            allCommits.set(hash, {
                                message,
                                packages: new Set() 
                            });
                        }
                        allCommits.get(hash).packages.add(packageName);
                    });
                }
                if (changelogB[packageName] && changelogB[packageName][versionB]) {
                    const commitsB = changelogB[packageName][versionB].commits || {};
                    Object.entries(commitsB).forEach(([hash, message]) => {
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

/**
 * Perform version comparison
 * @param {string} versionA - Base version
 * @param {string} versionB - Target version
 */
const performVersionComparison = async (versionA, versionB) => {
    try {
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
        
        // Extract packages from both versions
        const packagesA = extractPackagesFromVersion(changelogA);
        const packagesB = extractPackagesFromVersion(changelogB);
        
        // Compare packages
        const comparisonData = comparePackages(packagesA, packagesB, changelogA, changelogB);
        
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
    
    // Hide package-level comparison section in version comparison mode
    const packageLevelSection = document.getElementById('package-level-comparison-section');
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
    const packageSelect = document.getElementById('comparison-package-select');
    const packageRow = document.getElementById('comparison-package-row');
    
    if (!packageSelect || !packageRow) return;
    
    const allPackages = getUnionPackages(changelogA, changelogB);
    
    if (allPackages.length === 0) {
        packageSelect.innerHTML = '<option value="">No packages found</option>';
        packageRow.style.display = 'none';
        return;
    }
    
    let optionsHtml = '<option value="">Select a package (optional)</option>';
    allPackages.forEach(pkg => {
        optionsHtml += `<option value="${pkg}">${pkg}</option>`;
    });
    
    packageSelect.innerHTML = optionsHtml;
    packageRow.style.display = 'flex';
};

/**
 * Populate pre-release versions for a selected package
 * @param {string} packageName - Selected package name
 * @param {Object} changelog - Changelog data
 * @param {string} selectId - ID of the select element to populate
 * @param {string} stableVersion - The stable version (e.g., 3.3.1)
 */
const populatePrereleaseVersions = (packageName, changelog, selectId, stableVersion) => {
    const versionSelect = document.getElementById(selectId);
    
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

/**
 * Compare specific package versions between two stable releases
 * @param {string} packageName - Package to compare
 * @param {string} versionASpecific - Specific version in base (e.g., 3.3.1-next.22)
 * @param {string} versionBSpecific - Specific version in target (e.g., 3.4.0-next.25)
 * @param {Object} changelogA - Changelog for base stable version
 * @param {Object} changelogB - Changelog for target stable version
 */
const compareSpecificPackageVersions = (packageName, versionASpecific, versionBSpecific, changelogA, changelogB) => {
    const pkgDataA = changelogA[packageName]?.[versionASpecific];
    const pkgDataB = changelogB[packageName]?.[versionBSpecific];
    
    if (!pkgDataA && !pkgDataB) {
        alert('Could not find version data n 65for comparison in either version');
        return;
    }
    
    // Get commits from both versions
    const commitsA = pkgDataA?.commits || {};
    const commitsB = pkgDataB?.commits || {};
    
    // Collect ALL commits from both versions (not just differences)
    const allCommits = new Map();
    const commitsHashesA = new Set(Object.keys(commitsA));
    const commitsHashesB = new Set(Object.keys(commitsB));
    
    // Add ALL commits from version A (base)
    Object.entries(commitsA).forEach(([hash, message]) => {
        allCommits.set(hash, {
            message,
            inBase: true,
            inTarget: commitsHashesB.has(hash),
            packages: new Set([packageName])
        });
    });
    
    // Add commits from version B (target) that are not already in the map
    Object.entries(commitsB).forEach(([hash, message]) => {
        if (!allCommits.has(hash)) {
            allCommits.set(hash, {
                message,
                inBase: false,
                inTarget: true,
                packages: new Set([packageName])
            });
        }
    });
    
    // Convert to array for template
    const commitsList = Array.from(allCommits.entries()).map(([hash, data]) => ({
        hash,
        message: data.message,
        packageCount: data.packages.size,
        packages: Array.from(data.packages).sort(),
        inBase: data.inBase,
        inTarget: data.inTarget,
        inBoth: data.inBase && data.inTarget,
        onlyInBase: data.inBase && !data.inTarget,
        onlyInTarget: data.inTarget && !data.inBase,
        newCommit: data.inTarget && !data.inBase
    }));
    
    // Determine status
    let status = 'Unchanged';
    let changeClass = 'unchanged';
    if (!pkgDataA && pkgDataB) {
        status = 'Added';
        changeClass = 'only-in-b';
    } else if (pkgDataA && !pkgDataB) {
        status = 'Removed';
        changeClass = 'only-in-a';
    } else if (versionASpecific !== versionBSpecific) {
        status = 'Version Changed';
        changeClass = 'version-changed';
    }
    
    // Create comparison data in the same format as full version comparison
    const comparisonData = {
        versionA: versionASpecific,
        versionB: versionBSpecific,
        packages: [{
            packageName: packageName,
            versionA: pkgDataA ? versionASpecific : 'N/A',
            versionB: pkgDataB ? versionBSpecific : 'N/A',
            status: status,
            changeClass: changeClass
        }],
        commits: commitsList,
        totalPackages: 1,
        totalCommits: commitsList.length,
        changedCount: status === 'Version Changed' ? 1 : 0,
        unchangedCount: status === 'Unchanged' ? 1 : 0,
        onlyInACount: status === 'Removed' ? 1 : 0,
        onlyInBCount: status === 'Added' ? 1 : 0
    };
    
    // Display using the comparison template (same as full version comparison)
    const resultsDiv = document.getElementById('comparison-results');
    if (!resultsDiv) {
        console.error('comparison-results element not found');
        return;
    }
    
    const templateElement = document.getElementById('comparison-template');
    if (!templateElement) {
        console.error('comparison-template not found');
        return;
    }
    
    const template = Handlebars.compile(templateElement.innerHTML);
    
    try {
        const html = template(comparisonData);
        resultsDiv.innerHTML = html;
        resultsDiv.classList.remove('hide');
        
        // Update URL for sharing
        updateEnhancedComparisonURL(
            document.getElementById('version-a-select').value,
            document.getElementById('version-b-select').value,
            packageName,
            versionASpecific,
            versionBSpecific
        );
        
        // Show copy link button
        const copyLinkBtn = document.getElementById('copy-comparison-link');
        const helperText = document.getElementById('comparison-helper');
        if (copyLinkBtn) copyLinkBtn.classList.remove('hide');
        if (helperText) helperText.classList.remove('hide');
        
        // Scroll to results
        setTimeout(() => {
            resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    } catch (error) {
        console.error('Error rendering comparison:', error);
        resultsDiv.innerHTML = `<div style="color: red; padding: 20px;">Error: ${error.message}</div>`;
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
 * Initialize comparison mode functionality (Enhanced)
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
    const packageSelect = document.getElementById('comparison-package-select');
    const versionAPrereleaseSelect = document.getElementById('version-a-prerelease-select');
    const versionBPrereleaseSelect = document.getElementById('version-b-prerelease-select');
    const packageRow = document.getElementById('comparison-package-row');
    const prereleaseRow = document.getElementById('comparison-prerelease-row');
    
    // Store fetched changelogs to avoid re-fetching
    let cachedChangelogA = null;
    let cachedChangelogB = null;
    let currentStableA = null;
    let currentStableB = null;
    
    // Populate version dropdowns for comparison
    const populateComparisonVersions = () => {
        if (versionSelectDropdown && versionSelectDropdown.innerHTML) {
            const options = versionSelectDropdown.innerHTML;
            if (versionASelect) versionASelect.innerHTML = options;
            if (versionBSelect) versionBSelect.innerHTML = options;
        }
    };
    
    // Handle stable version changes
    const handleStableVersionChange = async () => {
        const stableA = versionASelect.value;
        const stableB = versionBSelect.value;
        
        // Reset package and pre-release selections
        if (packageSelect) packageSelect.value = '';
        if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
        if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
        if (packageRow) packageRow.style.display = 'none';
        if (prereleaseRow) prereleaseRow.style.display = 'none';
        
        // Update button state after clearing selections
        updateCompareButtonState();
        
        // If both stable versions selected, fetch changelogs and populate packages
        if (stableA && stableB && stableA !== stableB) {
            try {
                // Fetch both changelogs
                const [changelogA, changelogB] = await Promise.all([
                    fetch(versionPaths[stableA]).then(res => res.json()),
                    fetch(versionPaths[stableB]).then(res => res.json())
                ]);
                
                cachedChangelogA = changelogA;
                cachedChangelogB = changelogB;
                currentStableA = stableA;
                currentStableB = stableB;
                
                // Populate union of all packages
                populateUnionPackages(changelogA, changelogB);
                
                // Update button state after loading changelogs
                updateCompareButtonState();
            } catch (error) {
                console.error('Error loading changelogs:', error);
                alert('Error loading version data. Please try again.');
            }
        }
    };
    
    // Check and update comparison button state
    const updateCompareButtonState = () => {
        const compareBtn = document.getElementById('compare-button');
        if (!compareBtn) return;
        
        const selectedPackage = packageSelect ? packageSelect.value : null;
        const versionASpecific = versionAPrereleaseSelect ? versionAPrereleaseSelect.value : null;
        const versionBSpecific = versionBPrereleaseSelect ? versionBPrereleaseSelect.value : null;
        const prereleaseRowVisible = prereleaseRow && prereleaseRow.style.display !== 'none';
        
        // Disable button if:
        // 1. Package is selected but pre-release row is hidden
        // 2. Pre-release row is visible but both pre-release versions are not selected
        if (selectedPackage) {
            if (!prereleaseRowVisible) {
                compareBtn.disabled = true;
            } else if (!versionASpecific || !versionBSpecific) {
                compareBtn.disabled = true;
            } else {
                compareBtn.disabled = false;
            }
        } else {
            // No package selected - enable for full version comparison
            compareBtn.disabled = false;
        }
    };
    
    // Handle package selection
    const handlePackageChange = () => {
        const selectedPackage = packageSelect.value;
        
        // Reset pre-release selections
        if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
        if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
        
        if (selectedPackage && cachedChangelogA && cachedChangelogB) {
            // Populate pre-release versions for both stable versions
            populatePrereleaseVersions(
                selectedPackage, 
                cachedChangelogA, 
                'version-a-prerelease-select',
                currentStableA
            );
            populatePrereleaseVersions(
                selectedPackage, 
                cachedChangelogB, 
                'version-b-prerelease-select',
                currentStableB
            );
            
            // Show pre-release row
            if (prereleaseRow) {
                prereleaseRow.style.display = 'flex';
                // Update labels with actual version numbers
                const labelA = prereleaseRow.querySelector('label[for="version-a-prerelease-select"]');
                const labelB = prereleaseRow.querySelector('label[for="version-b-prerelease-select"]');
                if (labelA) labelA.textContent = `Pre-release Version for Base (${currentStableA}):`;
                if (labelB) labelB.textContent = `Pre-release Version for Target (${currentStableB}):`;
            }
        } else {
            if (prereleaseRow) prereleaseRow.style.display = 'none';
        }
        
        // Update button state after package change
        updateCompareButtonState();
    };
    
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
           
            // Clear URL
            const url = new URL(window.location);
            ['compare', 'versionA', 'versionB', 'compareStableA', 'compareStableB', 
             'comparePackage', 'compareVersionA', 'compareVersionB'].forEach(param => {
                url.searchParams.delete(param);
            });
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
            
            // Hide package-level comparison section in version comparison mode
            const packageLevelSection = document.getElementById('package-level-comparison-section');
            if (packageLevelSection) packageLevelSection.classList.add('hide');
            
            populateComparisonVersions();
        });
    }
    
    // Event listeners for version selection
    if (versionASelect) versionASelect.addEventListener('change', handleStableVersionChange);
    if (versionBSelect) versionBSelect.addEventListener('change', handleStableVersionChange);
    
    // Event listener for package selection
    if (packageSelect) packageSelect.addEventListener('change', handlePackageChange);
    
    // Event listeners for pre-release version selection to update button state
    if (versionAPrereleaseSelect) versionAPrereleaseSelect.addEventListener('change', updateCompareButtonState);
    if (versionBPrereleaseSelect) versionBPrereleaseSelect.addEventListener('change', updateCompareButtonState);
    
    // Comparison form submit
    if (comparisonForm) {
        comparisonForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const stableA = versionASelect.value;
            const stableB = versionBSelect.value;
            const selectedPackage = packageSelect ? packageSelect.value : null;
            const versionASpecific = versionAPrereleaseSelect ? versionAPrereleaseSelect.value : null;
            const versionBSpecific = versionBPrereleaseSelect ? versionBPrereleaseSelect.value : null;
            
            if (!stableA || !stableB) {
                alert('Please select both stable versions');
                return;
            }
            
            if (stableA === stableB) {
                alert('Please select two different stable versions');
                return;
            }
            
            // If package and specific versions are selected, do enhanced comparison
            if (selectedPackage && versionASpecific && versionBSpecific) {
                compareSpecificPackageVersions(
                    selectedPackage,
                    versionASpecific,
                    versionBSpecific,
                    cachedChangelogA,
                    cachedChangelogB
                );
                
                // Re-enable button after comparison
                const compareBtn = document.getElementById('compare-button');
                if (compareBtn) compareBtn.disabled = false;
            } else if (!selectedPackage) {
                // If no package selected, do full version comparison (existing functionality)
                performVersionComparison(stableA, stableB);
                
                // Re-enable button after comparison
                const compareBtn = document.getElementById('compare-button');
                if (compareBtn) compareBtn.disabled = false;
            } else {
                alert('Please select package and both pre-release versions, or leave package empty for full version comparison');
            }
        });
    }
    
    // Clear button
    const clearBtn = document.getElementById('clear-comparison-button');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (versionASelect) versionASelect.value = '';
            if (versionBSelect) versionBSelect.value = '';
            if (packageSelect) packageSelect.value = '';
            if (versionAPrereleaseSelect) versionAPrereleaseSelect.value = '';
            if (versionBPrereleaseSelect) versionBPrereleaseSelect.value = '';
            if (comparisonResults) comparisonResults.classList.add('hide');
            if (packageRow) packageRow.style.display = 'none';
            if (prereleaseRow) prereleaseRow.style.display = 'none';
            
            cachedChangelogA = null;
            cachedChangelogB = null;
            currentStableA = null;
            currentStableB = null;
            
            // Hide copy link button and helper
            const copyLinkBtn = document.getElementById('copy-comparison-link');
            const helperText = document.getElementById('comparison-helper');
            if (copyLinkBtn) copyLinkBtn.classList.add('hide');
            if (helperText) helperText.classList.add('hide');
            
            // Re-enable comparison button after clearing
            const compareBtn = document.getElementById('compare-button');
            if (compareBtn) compareBtn.disabled = false;
            
            // Clear URL
            const url = new URL(window.location);
            ['compare', 'versionA', 'versionB', 'compareStableA', 'compareStableB', 
             'comparePackage', 'compareVersionA', 'compareVersionB'].forEach(param => {
                url.searchParams.delete(param);
            });
            window.history.pushState({}, '', url);
        });
    }
    
    // Copy comparison link button - backup event listener
    const copyLinkBtn = document.getElementById('copy-comparison-link');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', copyComparisonLink);
    }
    
    // Check for URL parameters on page load - Enhanced comparison first
    const enhancedParams = await handleEnhancedComparisonURL();
    if (enhancedParams.shouldCompare) {
        // Switch to comparison mode
        switchToComparisonMode();
        
        // Wait for dropdowns to populate
        setTimeout(async () => {
            versionASelect.value = enhancedParams.stableA;
            versionBSelect.value = enhancedParams.stableB;
            
            await handleStableVersionChange();
            
            setTimeout(() => {
                packageSelect.value = enhancedParams.packageName;
                handlePackageChange();
                
                setTimeout(() => {
                    versionAPrereleaseSelect.value = enhancedParams.versionA;
                    versionBPrereleaseSelect.value = enhancedParams.versionB;
                    
                    compareSpecificPackageVersions(
                        enhancedParams.packageName,
                        enhancedParams.versionA,
                        enhancedParams.versionB,
                        cachedChangelogA,
                        cachedChangelogB
                    );
                }, 300);
            }, 300);
        }, 300);
    } else {
        // Check for old-style comparison URL
        const urlComparisonParams = await handleComparisonURLParams();
        if (urlComparisonParams.shouldCompare) {
            switchToComparisonMode(urlComparisonParams.versionA, urlComparisonParams.versionB);
            setTimeout(() => {
                performVersionComparison(urlComparisonParams.versionA, urlComparisonParams.versionB);
            }, 300);
        }
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
    initializeComparisonMode();
}