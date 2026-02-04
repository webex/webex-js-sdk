/**
 * Compare.js - UI layer for package comparison tool
 * 
 * ARCHITECTURE:
 * - This file provides the UI layer for the comparison tool (compare.html)
 * - Business logic is provided by Vivek's functions in app.js:
 *   * getUnionPackages() - Gets all packages from both versions
 *   * generatePackageComparisonData() - Core comparison logic
 *   * Other helper functions for data processing
 * 
 * UI Workflow: Package → Version1 → Version2 → PreRelease1 → PreRelease2
 */

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

// GitHub base URL - use from app.js if available, otherwise define it
const compareGithubBaseUrl = typeof github_base_url !== 'undefined' ? github_base_url : "https://github.com/webex/webex-js-sdk/";

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
    
    // Load main.json to get available versions
    const response = await fetch('logs/main.json');
    const mainData = await response.json();
    localVersionPaths = mainData;
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
 * Fetch changelog JSON file - Uses same logic as app.js
 */
async function fetchChangelogData(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

/**
 * Populate package dropdown - Load from one recent changelog
 */
async function populatePackageDropdown() {
  console.log('Loading packages...');
  
  // Load from v3.10.0 or fallback to v3.4.0
  const version = localVersionPaths['v3.10.0'] ? 'v3.10.0' : 'v3.4.0';
  const path = localVersionPaths[version];
  
  const changelog = await fetchChangelogData(path);
  
  // Use the business logic method from app.js to get sorted packages
  let packages;
  if (typeof getUnionPackages === 'function') {
    packages = getUnionPackages(changelog, changelog); // Get packages from one changelog
  } else {
    // Fallback if getUnionPackages is not available
    const specialPackages = ['webex', '@webex/calling'];
    let filteredPackages = Object.keys(changelog).filter(pkg => !specialPackages.includes(pkg));
    filteredPackages.sort();
    packages = [...specialPackages.filter(pkg => changelog[pkg]), ...filteredPackages];
  }
  
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
 * Sorted from oldest (0.0.0) to newest (3.10.0)
 */
async function populateVersionDropdowns() {
  const versions = Object.keys(localVersionPaths).sort((a, b) => {
    return a.localeCompare(b, undefined, { numeric: true }); // Changed to ascending order
  });
  
  const optionsHTML = '<option value="">Select version</option>' + 
    versions.map(v => {
      const displayVersion = v.replace(/^v/, ''); // Remove 'v' prefix for display
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
 * Populate pre-release versions - Compare tool version
 * Uses Vivek's exact business logic from app.js
 * Filters for pre-release versions matching the stable version
 * Auto-selects the first version by default
 */
function comparePopulatePrereleaseVersions(packageName, changelog, selectElement, stableVersion) {
  const stableVersionKey = stableVersion.replace(/^v/, ''); // Remove 'v' prefix
  
  // If package doesn't exist in this version's changelog
  if (!changelog[packageName]) {
    // Show stable version as fallback so comparison can still work
    selectElement.innerHTML = `<option value="${stableVersionKey}">${stableVersionKey} (default)</option>`;
    selectElement.value = stableVersionKey;
    selectElement.disabled = false;
    validateForm();
    return;
  }
  
  // Get all versions for this package
  const allVersions = Object.keys(changelog[packageName]);
  
  // Filter for pre-release versions matching the stable version
  // e.g., for stable version 3.7.0, get 3.7.0-next.1, 3.7.0-next.12, etc.
  const prereleaseVersions = allVersions.filter(v => 
    v.startsWith(stableVersionKey + '-') && v !== stableVersionKey
  );
  
  // Sort by version (newest first based on published date) - Vivek's logic
  prereleaseVersions.sort((a, b) => {
    const dateA = changelog[packageName][a]?.published_date || 0;
    const dateB = changelog[packageName][b]?.published_date || 0;
    return dateB - dateA;
  });
  
  let versionsToShow = [];
  let isStableVersionDefault = false;
  
  // Add the stable version itself as an option if it exists
  if (changelog[packageName][stableVersionKey]) {
    versionsToShow.push(stableVersionKey);
    // Check if stable version is the only option (no pre-releases)
    isStableVersionDefault = prereleaseVersions.length === 0;
  }
  
  // Add pre-release versions
  versionsToShow = [...versionsToShow, ...prereleaseVersions];
  
  // If no versions found at all, use stable version as fallback
  if (versionsToShow.length === 0) {
    versionsToShow = [stableVersionKey];
    isStableVersionDefault = true;
  }
  
  selectElement.innerHTML = versionsToShow.map((version, index) => {
    // Show (default) for stable version when it's the only/first option and there are no pre-releases
    const isStable = version === stableVersionKey;
    const showDefault = isStable && isStableVersionDefault;
    const displayText = showDefault ? `${version} (default)` : version;
    return `<option value="${version}">${displayText}</option>`;
  }).join('');
  
  // Auto-select the first version (newest)
  selectElement.value = versionsToShow[0];
  selectElement.disabled = false;
  
  // Trigger validation after auto-selection
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
 * Collect ALL commits between two stable versions (across all intermediate versions)
 * This provides a complete commit history between the stable versions
 */
async function collectAllCommitsBetweenStableVersions(packageName, stableVersion1, stableVersion2) {
  try {
    // Get all stable versions from localVersionPaths
    const allVersions = Object.keys(localVersionPaths)
      .map(v => v.replace(/^v/, ''))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    
    // Find the range of versions to check
    const v1 = stableVersion1.replace(/^v/, '');
    const v2 = stableVersion2.replace(/^v/, '');
    
    const startIdx = allVersions.indexOf(v1);
    const endIdx = allVersions.indexOf(v2);
    
    if (startIdx === -1 || endIdx === -1) {
      console.error('Could not find version indices');
      return { commitsA: [], commitsB: [] };
    }
    
    // Get all versions in the range (inclusive)
    const [minIdx, maxIdx] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const versionsInRange = allVersions.slice(minIdx, maxIdx + 1);
    
    console.log('Collecting commits from versions:', versionsInRange);
    
    // Fetch all changelogs in the range
    const allCommits = [];
    
    for (const version of versionsInRange) {
      const versionKey = `v${version}`;
      const changelog = await fetch(localVersionPaths[versionKey]).then(res => res.json());
      
      if (changelog[packageName]) {
        const packageVersions = changelog[packageName];
        
        // Collect commits from all versions of this package in this changelog
        Object.entries(packageVersions).forEach(([pkgVersion, pkgData]) => {
          if (pkgData.commits) {
            Object.entries(pkgData.commits).forEach(([hash, message]) => {
              allCommits.push({
                hash: hash,
                shortHash: hash.substring(0, 7),
                message: message,
                version: pkgVersion,
                stableVersion: version,
                url: `${compareGithubBaseUrl}commit/${hash}`
              });
            });
          }
        });
      }
    }
    
    // Remove duplicate commits (same hash might appear in multiple versions)
    const uniqueCommits = Array.from(
      new Map(allCommits.map(c => [c.hash, c])).values()
    );
    
    console.log(`Found ${uniqueCommits.length} unique commits across ${versionsInRange.length} versions`);
    
    return {
      commitsA: uniqueCommits,
      commitsB: [],
      totalCommits: uniqueCommits.length
    };
  } catch (error) {
    console.error('Error collecting commits:', error);
    return { commitsA: [], commitsB: [] };
  }
}

/**
 * Handle submit
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
    // Use business logic from app.js for package comparison
    const comparison = generatePackageComparisonData(
      selectedPackage,
      preRelease1Version,
      preRelease2Version,
      changelogData[selectedVersion1],
      changelogData[selectedVersion2]
    );
    
    // Collect ALL commits between the stable versions (not just from pre-release versions)
    const allCommits = await collectAllCommitsBetweenStableVersions(
      selectedPackage,
      selectedVersion1,
      selectedVersion2
    );
    
    // Merge the commit data - replace with complete history
    comparison.commitsA = allCommits.commitsA;
    comparison.commitsB = allCommits.commitsB;
    comparison.commitsCountA = allCommits.commitsA.length;
    comparison.commitsCountB = allCommits.commitsB.length;
    comparison.hasCommitsA = allCommits.commitsA.length > 0;
    comparison.hasCommitsB = allCommits.commitsB.length > 0;
    
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
    
    const baseUrl = typeof github_base_url !== 'undefined' ? github_base_url : compareGithubBaseUrl;
    
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initComparisonTool);
} else {
  initComparisonTool();
}
