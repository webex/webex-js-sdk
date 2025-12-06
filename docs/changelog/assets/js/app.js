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

Handlebars.registerHelper('substring', function(str, start, end) {
    return str ? str.substring(start, end) : '';
});

Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
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
    
    if(formParams.package === null || formParams.package.trim() === ''){
        disable.version = true;
    }
    else{
        disable.searchButton = false;
    }
    
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

    if(package !== null && package?.trim() !== ""){
        drill_down = {
            [package]: drill_down[package]
        };
    }

    if(version !== null && version?.trim() !== ""){
        drill_down = drill_down[package][version] ? {
            [package]: {
                [version]: drill_down[package][version]
            }
        } : {};
    }
    else if(
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

const toggleCommits = () => {
    const commitsList = document.getElementById('commits-list');
    const toggleText = document.getElementById('toggle-commits-text');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    if (commitsList && toggleText) {
        if (commitsList.classList.contains('hide')) {
            commitsList.classList.remove('hide');
            toggleText.textContent = 'Hide Commits';
            if (toggleIcon) toggleIcon.textContent = '▼';
        } else {
            commitsList.classList.add('hide');
            toggleText.textContent = 'Show Commits';
            if (toggleIcon) toggleIcon.textContent = '▶';
        }
    }
}

window.onhashchange = () => {
    populateVersions();
};

populateVersions();

/* ============================================
   VERSION COMPARISON FUNCTIONALITY
   ============================================ */

// Global state for comparison mode
let comparisonMode = false;

/**
 * Extract all packages from a version changelog
 * @param {Object} changelog - The changelog JSON for a version
 * @returns {Object} - Map of {packageName: latestVersion}
 */
const extractPackagesFromVersion = (changelog) => {
    const packageMap = {};
    
    for (const packageName in changelog) {
        if (!changelog.hasOwnProperty(packageName)) continue;
        
        const packageVersions = changelog[packageName];
        const versionKeys = Object.keys(packageVersions);
        
        if (versionKeys.length === 0) continue;
        
        // Find the latest version by published_date
        let latestVersion = versionKeys[0];
        let latestDate = packageVersions[versionKeys[0]].published_date || 0;
        
        versionKeys.forEach(version => {
            const publishedDate = packageVersions[version].published_date || 0;
            if (publishedDate > latestDate) {
                latestDate = publishedDate;
                latestVersion = version;
            }
        });
        
        packageMap[packageName] = latestVersion;
    }
    
    return packageMap;
};

/**
 * Compare packages between two versions and collect all commits
 * @param {Object} packagesA - {packageName: version} for version A
 * @param {Object} packagesB - {packageName: version} for version B
 * @param {Object} changelogA - Full changelog data for version A
 * @param {Object} changelogB - Full changelog data for version B
 * @returns {Object} - Comparison results with statistics and commits
 */
const comparePackages = (packagesA, packagesB, changelogA, changelogB) => {
    const allPackageNames = new Set([
        ...Object.keys(packagesA),
        ...Object.keys(packagesB)
    ]);
    
    const packages = [];
    const allCommits = new Map(); // hash -> {message, packages: Set(), timestamp}
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
                    const versionData = changelogB[packageName][versionB];
                    const commits = versionData.commits || {};
                    const publishedDate = versionData.published_date || 0;
                    
                    Object.entries(commits).forEach(([hash, message]) => {
                        if (!allCommits.has(hash)) {
                            allCommits.set(hash, {
                                message,
                                packages: new Set(),
                                timestamp: publishedDate
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
            
            // Collect commits from newly added packages in version B
            if (changelogB[packageName] && changelogB[packageName][versionB]) {
                const versionData = changelogB[packageName][versionB];
                const commits = versionData.commits || {};
                const publishedDate = versionData.published_date || 0;
                
                Object.entries(commits).forEach(([hash, message]) => {
                    if (!allCommits.has(hash)) {
                        allCommits.set(hash, {
                            message,
                            packages: new Set(),
                            timestamp: publishedDate
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
    
    // Convert commits Map to array and sort by timestamp (newest first)
    const commitsList = Array.from(allCommits.entries()).map(([hash, data]) => ({
        hash,
        message: data.message,
        packageCount: data.packages.size,
        packages: Array.from(data.packages).sort(),
        timestamp: data.timestamp
    })).sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`Collected ${commitsList.length} unique commits between versions`);
    
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
        
        // Extract and compare packages
        const packagesA = extractPackagesFromVersion(changelogA);
        const packagesB = extractPackagesFromVersion(changelogB);
        
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
        if (copyLinkBtn) copyLinkBtn.classList.remove('hide');
        if (helperText) helperText.classList.remove('hide');
        
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
    
    // Copy comparison link button
    const copyLinkBtn = document.getElementById('copy-comparison-link');
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            const currentURL = window.location.href;
            
            // Copy to clipboard
            navigator.clipboard.writeText(currentURL).then(() => {
                // Visual feedback
                const originalText = copyLinkBtn.textContent;
                copyLinkBtn.textContent = '✓ Link Copied!';
                copyLinkBtn.style.backgroundColor = '#28a745';
                
                setTimeout(() => {
                    copyLinkBtn.textContent = originalText;
                    copyLinkBtn.style.backgroundColor = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy link:', err);
                alert('Failed to copy link. Please copy from the address bar.');
            });
        });
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
