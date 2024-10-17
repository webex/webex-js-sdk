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
    return `${new Date(1723028345568).toDateString()} ${new Date(1723028345568).toTimeString()}`;
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

window.onhashchange = () => {
    populateVersions();
};

populateVersions();
