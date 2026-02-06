/**
 * Compare.js - UI/controller layer. All DOM, event listeners, fetching, rendering.
 * app.js contains only pure business logic (data in → data out).
 * This file loads on both index.html (changelog search) and compare.html (version comparison).
 */

import {
  github_base_url,
  getUnionPackages,
  generatePackageComparisonData,
  getVersionRange,
  collectAllCommitsBetweenStableVersions,
  getPrereleaseOptionsForStableVersion,
  getSortedVersionKeys,
  getSearchResults,
  validateVersionInputResult,
  getPackageListForChangelog,
  computeFormState
} from './app.js';

// UI-layer fetch (app.js has no document/window/fetch)
async function fetchChangelogData(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}
async function fetchVersionPaths() {
  const response = await fetch('logs/main.json');
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

// DOM Elements - Will be initialized after DOM loads
let packageNameSelect;
let version1Select;
let version2Select;
let preRelease1Select;
let preRelease2Select;
let submitBtn;
let resetBtn;
let clearVersion1Btn;
let clearVersion2Btn;
let resultsSection;
let packageTableBody;
let commitHistoryBody;
let version1Header;
let version2Header;
let totalPackagesEl;
let changedPackagesEl;
let addedPackagesEl;
let removedPackagesEl;
let unchangedPackagesEl;

// State management
let changelogData = {};
let selectedPackage = null;
let selectedVersion1 = null;
let selectedVersion2 = null;
let comparisonData = null;
let localVersionPaths = {}; // Local copy of version paths


/**
 * Initialize DOM element references
 */
function initDOMElements() {
  packageNameSelect = document.getElementById('packageName');
  version1Select = document.getElementById('version1');
  version2Select = document.getElementById('version2');
  preRelease1Select = document.getElementById('preRelease1');
  preRelease2Select = document.getElementById('preRelease2');
  submitBtn = document.getElementById('submitBtn');
  resetBtn = document.getElementById('resetBtn');
  clearVersion1Btn = document.getElementById('clearVersion1');
  clearVersion2Btn = document.getElementById('clearVersion2');
  resultsSection = document.getElementById('resultsSection');
  packageTableBody = document.getElementById('packageTableBody');
  commitHistoryBody = document.getElementById('commitHistoryBody');
  version1Header = document.getElementById('version1Header');
  version2Header = document.getElementById('version2Header');
  totalPackagesEl = document.getElementById('totalPackages');
  changedPackagesEl = document.getElementById('changedPackages');
  addedPackagesEl = document.getElementById('addedPackages');
  removedPackagesEl = document.getElementById('removedPackages');
  unchangedPackagesEl = document.getElementById('unchangedPackages');
  
  console.log('✓ DOM elements initialized');
}

/**
 * Initialize the comparison tool
 */
async function initComparisonTool() {
  try {
    console.log('Initializing comparison tool...');
    
    // Initialize DOM elements first
    initDOMElements();
    
    // Load version paths via business logic layer
    localVersionPaths = await fetchVersionPaths();
    console.log('✓ Loaded', Object.keys(localVersionPaths).length, 'versions');
    
    // Populate package names
    await populatePackageDropdown();
    
    // Setup event listeners
    setupEventListeners();
    console.log('✓ Event listeners setup complete');
    
    // Handle URL parameters if any
    compareHandleURLParameters();
    
  } catch (error) {
    console.error('✗ Error initializing:', error);
    alert('Failed to load version data. Check console for details.');
  }
}

/**
 * Populate package dropdown - Load from one recent changelog, use app.js for package list
 */
async function populatePackageDropdown() {
  console.log('Loading packages...');
  const versionKeys = getSortedVersionKeys(localVersionPaths);
  const version = localVersionPaths['v3.10.0'] ? 'v3.10.0' : (localVersionPaths['v3.4.0'] ? 'v3.4.0' : versionKeys[versionKeys.length - 1]);
  const path = version ? localVersionPaths[version] : null;
  if (!path) {
    console.warn('No version data in logs/main.json — add version mappings for local testing.');
    packageNameSelect.innerHTML = '<option value="">No version data (fill logs/main.json for testing)</option>';
    return;
  }
  const changelog = await fetchChangelogData(path);
  const packages = getUnionPackages(changelog, changelog);

  packageNameSelect.innerHTML = '<option value="">Select a package</option>';
  packages.forEach(pkg => {
    const option = document.createElement('option');
    option.value = pkg;
    option.textContent = pkg;
    packageNameSelect.appendChild(option);
  });
  console.log('✓ Loaded', packages.length, 'packages');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  packageNameSelect.addEventListener('change', compareHandlePackageChange);
  version1Select.addEventListener('change', compareHandleVersion1Change);
  version2Select.addEventListener('change', compareHandleVersion2Change);
  preRelease1Select.addEventListener('change', validateForm);
  preRelease2Select.addEventListener('change', validateForm);
  submitBtn.addEventListener('click', compareHandleSubmit);
  resetBtn.addEventListener('click', compareHandleReset);
  clearVersion1Btn.addEventListener('click', () => clearVersionSelection('version1'));
  clearVersion2Btn.addEventListener('click', () => clearVersionSelection('version2'));
  document.querySelector('.filter-buttons')?.addEventListener('click', compareHandleFilterClick);
}

/**
 * Handle package selection
 */
async function compareHandlePackageChange(event) {
  selectedPackage = event.target.value;
  
  if (!selectedPackage) {
    version1Select.disabled = true;
    version2Select.disabled = true;
    version1Select.innerHTML = '<option value="">Select version</option>';
    version2Select.innerHTML = '<option value="">Select version</option>';
    resetPreReleaseDropdowns();
    validateForm();
    return;
  }
  
  await populateVersionDropdowns();
  version1Select.disabled = false;
  version2Select.disabled = false;
}

/**
 * Populate version dropdowns (without 'v' prefix for display)
 * Uses app.js for sorted version list
 */
function populateVersionDropdowns() {
  const versions = getSortedVersionKeys(localVersionPaths);
  const optionsHTML = '<option value="">Select version</option>' +
    versions.map(v => {
      const displayVersion = v.replace(/^v/, '');
      return `<option value="${v}">${displayVersion}</option>`;
    }).join('');
  version1Select.innerHTML = optionsHTML;
  version2Select.innerHTML = optionsHTML;
}

/**
 * Handle Version 1 selection
 */
async function compareHandleVersion1Change(event) {
  selectedVersion1 = event.target.value;
  
  if (!selectedVersion1) {
    preRelease1Select.disabled = true;
    preRelease1Select.innerHTML = '<option value="">Select a version first</option>';
    clearVersion1Btn.classList.add('hidden');
    version1Select.disabled = false; // Re-enable if cleared
    validateForm();
    return;
  }
  
  clearVersion1Btn.classList.remove('hidden');
  version1Header.textContent = `Version 1 (${selectedVersion1})`;
  
  // Disable Version 1 dropdown after selection
  version1Select.disabled = true;
  
  try {
    const changelogPath = localVersionPaths[selectedVersion1];
    const changelog = await fetchChangelogData(changelogPath);
    changelogData[selectedVersion1] = changelog;
    
    comparePopulatePrereleaseVersions(selectedPackage, changelog, preRelease1Select, selectedVersion1);
  } catch (error) {
    console.error('Error loading version 1:', error);
    alert('Failed to load version 1 data');
    version1Select.disabled = false; // Re-enable on error
  }
  
  validateForm();
}

/**
 * Handle Version 2 selection
 */
async function compareHandleVersion2Change(event) {
  selectedVersion2 = event.target.value;
  
  if (!selectedVersion2) {
    preRelease2Select.disabled = true;
    preRelease2Select.innerHTML = '<option value="">Select a version first</option>';
    clearVersion2Btn.classList.add('hidden');
    version2Select.disabled = false; // Re-enable if cleared
    validateForm();
    return;
  }
  
  clearVersion2Btn.classList.remove('hidden');
  version2Header.textContent = `Version 2 (${selectedVersion2})`;
  
  // Disable Version 2 dropdown after selection
  version2Select.disabled = true;
  
  try {
    const changelogPath = localVersionPaths[selectedVersion2];
    const changelog = await fetchChangelogData(changelogPath);
    changelogData[selectedVersion2] = changelog;
    
    comparePopulatePrereleaseVersions(selectedPackage, changelog, preRelease2Select, selectedVersion2);
  } catch (error) {
    console.error('Error loading version 2:', error);
    alert('Failed to load version 2 data');
    version2Select.disabled = false; // Re-enable on error
  }
  
  validateForm();
}

/**
 * Populate pre-release dropdown - UI only: get data from app.js, render options
 */
function comparePopulatePrereleaseVersions(packageName, changelog, selectElement, stableVersion) {
  const { options, defaultValue } = getPrereleaseOptionsForStableVersion(packageName, changelog, stableVersion);
  selectElement.innerHTML = options
    .map((opt) => `<option value="${opt.value}">${opt.displayText}</option>`)
    .join('');
  selectElement.value = defaultValue;
  selectElement.disabled = false;
  validateForm();
}

/**
 * Clear version selection
 */
function clearVersionSelection(versionNum) {
  if (versionNum === 'version1') {
    version1Select.value = '';
    version1Select.disabled = false; // Re-enable dropdown
    selectedVersion1 = null;
    preRelease1Select.disabled = true;
    preRelease1Select.innerHTML = '<option value="">Select a version first</option>';
    clearVersion1Btn.classList.add('hidden');
  } else if (versionNum === 'version2') {
    version2Select.value = '';
    version2Select.disabled = false; // Re-enable dropdown
    selectedVersion2 = null;
    preRelease2Select.disabled = true;
    preRelease2Select.innerHTML = '<option value="">Select a version first</option>';
    clearVersion2Btn.classList.add('hidden');
  }
  
  validateForm();
}

/**
 * Reset pre-release dropdowns
 */
function resetPreReleaseDropdowns() {
  preRelease1Select.disabled = true;
  preRelease2Select.disabled = true;
  preRelease1Select.innerHTML = '<option value="">Select a version first</option>';
  preRelease2Select.innerHTML = '<option value="">First select Version 2</option>';
  preRelease1Select.value = '';
  preRelease2Select.value = '';
}

/**
 * Validate form
 */
function validateForm() {
  const isValid = selectedPackage && 
                  selectedVersion1 && 
                  selectedVersion2 && 
                  preRelease1Select.value && 
                  preRelease2Select.value;
  
  submitBtn.disabled = !isValid;
}

/**
 * Handle submit - orchestrate: get user input, call app.js APIs, render results
 */
async function compareHandleSubmit() {
  const preRelease1Version = preRelease1Select.value;
  const preRelease2Version = preRelease2Select.value;

  if (!selectedPackage || !selectedVersion1 || !selectedVersion2 ||
      !preRelease1Version || !preRelease2Version) {
    alert('Please select all required fields');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Comparing...';

  try {
    const comparison = generatePackageComparisonData(
      selectedPackage,
      preRelease1Version,
      preRelease2Version,
      changelogData[selectedVersion1],
      changelogData[selectedVersion2]
    );

    const versionRange = getVersionRange(localVersionPaths, selectedVersion1, selectedVersion2);
    const changelogsByVersion = { ...changelogData };
    for (const versionKey of versionRange) {
      if (!changelogsByVersion[versionKey]) {
        changelogsByVersion[versionKey] = await fetchChangelogData(localVersionPaths[versionKey]);
      }
    }
    const { commits } = collectAllCommitsBetweenStableVersions(
      selectedPackage,
      selectedVersion1,
      selectedVersion2,
      localVersionPaths,
      changelogsByVersion
    );

    comparison.commitsA = commits;
    comparison.commitsB = [];
    comparison.commitsCountA = commits.length;
    comparison.commitsCountB = 0;
    comparison.hasCommitsA = commits.length > 0;
    comparison.hasCommitsB = false;

    comparisonData = comparison;
    displayComparisonResults(comparison);
    compareUpdateURL();
  } catch (error) {
    console.error('Comparison error:', error);
    alert('Failed to compare versions. Check console for details.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
  }
}

/**
 * Display comparison results
 */
function displayComparisonResults(comparison) {
  resultsSection.classList.remove('hidden');
  
  totalPackagesEl.textContent = comparison.totalPackages || 1;
  changedPackagesEl.textContent = comparison.changedCount || 0;
  addedPackagesEl.textContent = comparison.onlyInBCount || 0;
  removedPackagesEl.textContent = comparison.onlyInACount || 0;
  unchangedPackagesEl.textContent = comparison.unchangedCount || 0;
  
  displayPackageTable(comparison);
  displayCommitHistory(comparison);
  
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Display package table
 */
function displayPackageTable(comparison) {
  packageTableBody.innerHTML = '';
  
  const packages = comparison.packages || [];
  
  if (packages.length === 0) {
    packageTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No packages to compare</td></tr>';
    return;
  }
  
  packages.forEach(pkg => {
    const row = document.createElement('tr');
    
    // Map status from app.js format to filter format
    const statusMap = {
      'Version Changed': 'changed',
      'Added': 'added',
      'Removed': 'removed',
      'Unchanged': 'unchanged'
    };
    
    const filterStatus = statusMap[pkg.status] || 'unchanged';
    row.dataset.status = filterStatus;
    
    const statusClass = filterStatus;
    
    row.innerHTML = `
      <td>${pkg.packageName}</td>
      <td>${pkg.versionA || '-'}</td>
      <td>${pkg.versionB || '-'}</td>
      <td><span class="status-badge ${statusClass}">${pkg.status}</span></td>
    `;
    
    packageTableBody.appendChild(row);
  });
}

/**
 * Display commit history
 */
function displayCommitHistory(comparison) {
  commitHistoryBody.innerHTML = '';
  
  const commitsA = comparison.commitsA || [];
  const commitsB = comparison.commitsB || [];
  
  // Since we're collecting ALL commits between versions, they're all in commitsA
  const allCommits = commitsA;
  
  if (allCommits.length === 0) {
    commitHistoryBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No commits found</td></tr>';
    return;
  }
  
  allCommits.forEach(commit => {
    const row = document.createElement('tr');
    
    const baseUrl = github_base_url;
    
    const commitLink = commit.hash ? 
      `<a href="${baseUrl}commit/${commit.hash}" target="_blank">${commit.shortHash}</a>` : 
      commit.shortHash || 'N/A';
    
    const messageWithLinks = (commit.message || 'No message').replace(
      /#(\d+)/g, 
      `<a href="${baseUrl}pull/$1" target="_blank">#$1</a>`
    );
    
    // Show the specific version this commit was in
    const versionInfo = commit.version || 'N/A';
    
    row.innerHTML = `
      <td>${commitLink}</td>
      <td>${messageWithLinks}</td>
      <td>${selectedPackage}</td>
      <td>${versionInfo}</td>
    `;
    
    commitHistoryBody.appendChild(row);
  });
}

/**
 * Handle filter click
 */
function compareHandleFilterClick(event) {
  if (!event.target.classList.contains('filter-btn')) return;
  
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  const filter = event.target.dataset.filter;
  
  const rows = packageTableBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (filter === 'all') {
      row.style.display = '';
    } else {
      row.style.display = row.dataset.status === filter ? '' : 'none';
    }
  });
}

/**
 * Handle reset
 */
function compareHandleReset() {
  packageNameSelect.value = '';
  version1Select.value = '';
  version2Select.value = '';
  version1Select.disabled = true;
  version2Select.disabled = true;
  
  resetPreReleaseDropdowns();
  
  selectedPackage = null;
  selectedVersion1 = null;
  selectedVersion2 = null;
  comparisonData = null;
  
  resultsSection.classList.add('hidden');
  window.history.replaceState({}, document.title, window.location.pathname);
  
  clearVersion1Btn.classList.add('hidden');
  clearVersion2Btn.classList.add('hidden');
  
  validateForm();
}

/**
 * Update URL with comparison parameters for sharing/bookmarking
 */
function compareUpdateURL() {
  const params = new URLSearchParams();
  params.set('package', selectedPackage);
  params.set('stableA', selectedVersion1);
  params.set('stableB', selectedVersion2);
  params.set('versionA', preRelease1Select.value);
  params.set('versionB', preRelease2Select.value);
  
  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({ comparison: true }, '', newURL);
}

/**
 * Handle URL parameters
 */
function compareHandleURLParameters() {
  const params = new URLSearchParams(window.location.search);
  
  const urlPackage = params.get('package');
  const urlStableA = params.get('stableA');
  const urlStableB = params.get('stableB');
  const urlVersionA = params.get('versionA');
  const urlVersionB = params.get('versionB');
  
  if (urlPackage && urlStableA && urlStableB && urlVersionA && urlVersionB) {
    setTimeout(async () => {
      packageNameSelect.value = urlPackage;
      await compareHandlePackageChange({ target: { value: urlPackage } });
      
      version1Select.value = urlStableA;
      await compareHandleVersion1Change({ target: { value: urlStableA } });
      
      version2Select.value = urlStableB;
      await compareHandleVersion2Change({ target: { value: urlStableB } });
      
      setTimeout(() => {
        preRelease1Select.value = urlVersionA;
        preRelease2Select.value = urlVersionB;
        validateForm();
        
        if (submitBtn.disabled === false) {
          compareHandleSubmit();
        }
      }, 500);
    }, 500);
  }
}

/* ============================================
   INDEX PAGE (changelog search) - UI only
   ============================================ */
let indexVersionPaths = {};
let indexCurrentChangelog = null;

function initIndexPage() {
  if (!document.getElementById('version-select')) return;
  registerIndexHandlebarsHelpers();
  const versionSelectDropdown = document.getElementById('version-select');
  const searchResults = document.getElementById('search-results');
  if (searchResults) searchResults.classList.add('hide');
  indexSetupEventListeners();
  indexPopulateVersions();
}

function registerIndexHandlebarsHelpers() {
  if (typeof Handlebars === 'undefined') return;
  Handlebars.registerHelper('forIn', function (object) {
    const arr = [];
    for (const prop in object) arr.push({ key: prop, value: object[prop] });
    return arr;
  });
  Handlebars.registerHelper('json', function (context, pkgName, version) {
    return JSON.stringify({ ...context, [pkgName]: version });
  });
  Handlebars.registerHelper('github_linking', function (string, type) {
    if (type === 'hash') return `<a href='${github_base_url}commit/${string}' target='_blank'>${string}</a>`;
    if (type === 'message') return string.replace(/#(\d+)/g, `<a href="${github_base_url}pull/$1" target="_blank">#$1</a>`);
    return string;
  });
  Handlebars.registerHelper('convertDate', function (timestamp) {
    return `${new Date(timestamp).toDateString()} ${new Date(timestamp).toTimeString()}`;
  });
}

async function indexPopulateVersions() {
  const versionSelectDropdown = document.getElementById('version-select');
  if (!versionSelectDropdown) return;
  try {
    const data = await fetchVersionPaths();
    indexVersionPaths = data;
    const versions = getSortedVersionKeys(data);
    versionSelectDropdown.innerHTML = '<option value="">Select a version</option>' +
      versions.map(v => `<option value="${v}">${v}</option>`).join('');
    indexPopulateFormFieldsFromURL();
  } catch (e) {
    console.error('Error fetching version data:', e);
  }
}

function indexSetupEventListeners() {
  const versionSelectDropdown = document.getElementById('version-select');
  const packageNameInputDropdown = document.getElementById('package-name-input');
  const versionInput = document.getElementById('version-input');
  const commitMessageInput = document.getElementById('commit-message-input');
  const commitHashInput = document.getElementById('commit-hash-input');
  const searchForm = document.getElementById('search-form');
  if (versionSelectDropdown) versionSelectDropdown.addEventListener('change', (e) => indexDoStableVersionChange(e.target.value));
  [versionInput, commitHashInput, commitMessageInput].forEach(el => { if (el) el.addEventListener('keyup', () => indexUpdateFormState()); });
  if (packageNameInputDropdown) packageNameInputDropdown.addEventListener('change', () => indexUpdateFormState());
  if (versionInput) versionInput.addEventListener('keyup', (e) => indexValidateVersionInput(e.target.value));
  if (searchForm) searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (versionSelectDropdown.value) q.set('stable_version', versionSelectDropdown.value);
    if (packageNameInputDropdown.value) q.set('package', packageNameInputDropdown.value);
    if (versionInput.value) q.set('version', versionInput.value);
    if (commitMessageInput.value) q.set('commitMessage', commitMessageInput.value);
    if (commitHashInput.value) q.set('commitHash', commitHashInput.value);
    window.history.pushState({}, 'Cisco Webex JS SDK', `${window.location.pathname}?${q}`);
    indexPopulateVersions();
  });
  window.onhashchange = () => indexPopulateVersions();
}

async function indexDoStableVersionChange(stable_version) {
  const packageNameInputDropdown = document.getElementById('package-name-input');
  const versionInput = document.getElementById('version-input');
  if (!stable_version || !indexVersionPaths[stable_version]) {
    indexUpdateFormState();
    return;
  }
  packageNameInputDropdown.disabled = false;
  try {
    indexCurrentChangelog = await fetchChangelogData(indexVersionPaths[stable_version]);
    indexPopulatePackageNames(indexCurrentChangelog);
  } catch (e) {
    console.error('Error fetching changelog:', e);
  }
  indexUpdateFormState();
  if (versionInput && versionInput.value.trim() !== '') indexValidateVersionInput(versionInput.value);
}

function indexPopulatePackageNames(changelog) {
  const packageNameInputDropdown = document.getElementById('package-name-input');
  if (!packageNameInputDropdown) return;
  const list = getPackageListForChangelog(changelog);
  let html = '<option value="">Select a package</option>';
  list.forEach(name => {
    if (name === 'separator') html += '<option disabled>──────────</option>';
    else html += `<option value="${name}">${name}</option>`;
  });
  packageNameInputDropdown.value = 'webex';
  packageNameInputDropdown.innerHTML = html;
}

function indexUpdateFormState() {
  const versionSelectDropdown = document.getElementById('version-select');
  const packageNameInputDropdown = document.getElementById('package-name-input');
  const versionInput = document.getElementById('version-input');
  const versionInputGroup = document.getElementById('version-input-group');
  const commitMessageInput = document.getElementById('commit-message-input');
  const commitMessageGroup = document.getElementById('commit-message-group');
  const commitHashInput = document.getElementById('commit-hash-input');
  const commitHashGroup = document.getElementById('commit-hash-group');
  const packageInputGroup = document.getElementById('package-input-group');
  const searchButton = document.getElementById('search-button');
  const formParams = {
    stable_version: versionSelectDropdown?.value ?? '',
    package: packageNameInputDropdown?.value ?? '',
    version: versionInput?.value ?? '',
    commitMessage: commitMessageInput?.value ?? '',
    commitHash: commitHashInput?.value ?? ''
  };
  const { disable } = computeFormState(formParams);
  if (disable.package) {
    if (packageNameInputDropdown) { packageNameInputDropdown.disabled = true; packageNameInputDropdown.value = ''; }
    if (packageInputGroup) packageInputGroup.classList.add('hide');
  } else {
    if (packageNameInputDropdown) packageNameInputDropdown.disabled = false;
    if (packageInputGroup) packageInputGroup.classList.remove('hide');
  }
  if (disable.version) {
    if (versionInput) { versionInput.disabled = true; versionInput.value = ''; }
    if (versionInputGroup) versionInputGroup.classList.add('hide');
  } else {
    if (versionInput) versionInput.disabled = false;
    if (versionInputGroup) versionInputGroup.classList.remove('hide');
  }
  if (disable.commitMessage) {
    if (commitMessageInput) { commitMessageInput.disabled = true; commitMessageInput.value = ''; }
    if (commitMessageGroup) commitMessageGroup.classList.add('hide');
  } else {
    if (commitMessageInput) commitMessageInput.disabled = false;
    if (commitMessageGroup) commitMessageGroup.classList.remove('hide');
  }
  if (disable.commitHash) {
    if (commitHashInput) { commitHashInput.disabled = true; commitHashInput.value = ''; }
    if (commitHashGroup) commitHashGroup.classList.add('hide');
  } else {
    if (commitHashInput) commitHashInput.disabled = false;
    if (commitHashGroup) commitHashGroup.classList.remove('hide');
  }
  if (searchButton) searchButton.disabled = disable.searchButton;
}

function indexValidateVersionInput(version) {
  const versionSelectDropdown = document.getElementById('version-select');
  const versionInputError = document.getElementById('version-input-error');
  const versionInput = document.getElementById('version-input');
  const searchButton = document.getElementById('search-button');
  const stableVersion = versionSelectDropdown?.value ?? '';
  const { valid, errorMessage } = validateVersionInputResult(version, stableVersion);
  if (versionInputError) versionInputError.innerText = errorMessage;
  if (versionInput && !valid) versionInput.focus();
  if (searchButton) searchButton.disabled = !valid;
}

function indexDoSearch(searchParams) {
  const searchResults = document.getElementById('search-results');
  const template = document.getElementById('changelog-item-template');
  if (!searchResults || !template || typeof Handlebars === 'undefined') return;
  const { search_results, stable_version } = getSearchResults(indexCurrentChangelog, searchParams);
  const changelogUI = Handlebars.compile(template.innerHTML);
  const html = changelogUI({ data: { search_results, stable_version } });
  searchResults.innerHTML = html;
  searchResults.classList.remove('hide');
}

function indexCopyToClipboard(copyButton) {
  navigator.clipboard.writeText(JSON.stringify(JSON.parse(copyButton.dataset.alongWith), null, 4));
  const span = copyButton.querySelector('span');
  if (span) { span.textContent = 'Copied!'; setTimeout(() => { span.textContent = 'Copy'; }, 2000); }
}

async function indexPopulateFormFieldsFromURL() {
  const params = new URLSearchParams(window.location.search);
  const searchParams = {
    stable_version: params.get('stable_version'),
    package: params.get('package'),
    version: params.get('version'),
    commitMessage: params.get('commitMessage'),
    commitHash: params.get('commitHash')
  };
  const versionSelectDropdown = document.getElementById('version-select');
  const packageNameInputDropdown = document.getElementById('package-name-input');
  const versionInput = document.getElementById('version-input');
  const commitMessageInput = document.getElementById('commit-message-input');
  const commitHashInput = document.getElementById('commit-hash-input');
  let hasParam = false;
  if (searchParams.stable_version) {
    if (versionSelectDropdown) versionSelectDropdown.value = searchParams.stable_version;
    await indexDoStableVersionChange(searchParams.stable_version);
  }
  if (searchParams.package && packageNameInputDropdown && !packageNameInputDropdown.disabled) {
    packageNameInputDropdown.value = searchParams.package;
    packageNameInputDropdown.dispatchEvent(new Event('change'));
    hasParam = true;
  }
  if (searchParams.version && versionInput) {
    versionInput.value = searchParams.version;
    indexValidateVersionInput(searchParams.version);
    hasParam = true;
  }
  if (searchParams.commitMessage && commitMessageInput) { commitMessageInput.value = searchParams.commitMessage; hasParam = true; }
  if (searchParams.commitHash && commitHashInput) { commitHashInput.value = searchParams.commitHash; hasParam = true; }
  indexUpdateFormState();
  if (hasParam) indexDoSearch(searchParams);
}

// Expose copy for index template onclick
window.copyToClipboard = indexCopyToClipboard;

// Initialize: index page (changelog search) vs compare page
function init() {
  if (document.getElementById('version-select')) {
    initIndexPage();
  } else {
    initComparisonTool();
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
