# Webex JS SDK Changelog Portal

This is the changelog portal for the Webex JS SDK. It includes a comprehensive **Version Comparison** feature with both full-version and granular package-level comparison capabilities.

## 🚀 Quick Start

### Option 1: Using Python's Built-in HTTP Server (Recommended)

```bash
# Navigate to the changelog directory
cd /Users/vinvivek/Desktop/webex-Changelog/webex-js-sdk/docs/changelog

# Start a local web server on port 8000
python3 -m http.server 8000
```

Then open your browser to: **http://localhost:8000**

### Option 2: Using Node.js HTTP Server

```bash
# Install http-server globally (one-time setup)
npm install -g http-server

# Navigate to the changelog directory
cd /Users/vinvivek/Desktop/webex-Changelog/webex-js-sdk/docs/changelog

# Start the server
http-server -p 8000
```

Then open your browser to: **http://localhost:8000**

### Option 3: Using PHP's Built-in Server

```bash
# Navigate to the changelog directory
cd /Users/vinvivek/Desktop/webex-Changelog/webex-js-sdk/docs/changelog

# Start PHP server
php -S localhost:8000
```

Then open your browser to: **http://localhost:8000**

### Option 4: Open Directly in Browser (May have CORS issues)

Simply open the `index.html` file in your browser:

```bash
open /Users/vinvivek/Desktop/webex-Changelog/webex-js-sdk/docs/changelog/index.html
```

**Note:** This method may have CORS (Cross-Origin Resource Sharing) issues when fetching JSON files. Using a local server is recommended.

---

## ✨ Features

### 1. Single Version View (Original Feature)
- Search by package name
- Search by version number
- Search by commit message
- Search by commit hash
- View all packages released with a specific version
- URL-based bookmarkable searches

### 2. **Full Version Comparison** 🆕
Compare all packages between two stable SDK releases:
- Select two SDK versions (e.g., `3.9.0` vs `3.10.0`)
- See comprehensive comparison including:
  - **Package versions** comparison table for all packages
  - **Union-based package detection** - Shows packages from both versions, even if unique to one
  - **Summary statistics** (Total, Changed, Unchanged, Added, Removed)
- Color-coded differences:
  - 🟡 **Yellow**: Version changed between releases
  - 🔴 **Red**: Package removed in target version
  - 🟢 **Green**: Package added in target version
  - ⚪ **White**: Package unchanged (same version)
- Parallel data fetching for optimal performance
- Shareable permalink generation

### 3. **Granular Package-Level Comparison** 🆕 (Advanced)
Deep-dive into specific packages with pre-release version support:
- **Two-step selection process**:
  1. Select two stable versions (Base A and Target B)
  2. Optionally select a specific package for detailed comparison
- **Pre-release version comparison**:
  - Compare specific pre-release versions (e.g., `3.10.0-next.5` vs `3.10.0-next.12`)
  - See all packages published alongside the selected package version
  - View version changes for all related packages in the SDK
- **Smart package dropdown**:
  - Shows union of all packages from both versions
  - Packages sorted alphabetically with priority for `webex` and `@webex/calling`
  - Includes packages unique to either version
- **Flexible comparison options**:
  - Compare pre-release version in A with pre-release in B
  - Compare pre-release with stable version
  - Compare same package across different stable releases
  - At least one pre-release version must be selected
- **Comprehensive results**:
  - Main package comparison row highlighted
  - All related packages from both changelogs
  - Change tracking across entire dependency tree

---

## 📖 How to Use Version Comparison

### Basic Setup
1. **Start the local server** using one of the methods above
2. **Open the changelog portal** in your browser
3. **Click "Version Comparison"** button at the top

### Mode A: Full Version Comparison (All Packages)

**Steps:**
1. **Select Base Version (A)** - The version you want to compare from
2. **Select Target Version (B)** - The version you want to compare to
3. **Leave package selection empty**
4. **Click "Compare Versions"**
5. **View the results** - See all packages and their version differences

**Example Comparisons:**
- Compare `3.9.0` vs `3.10.0` - See what changed in the latest release
- Compare `3.3.1` vs `3.10.0` - See all changes across multiple releases
- Compare any two versions to understand package evolution

### Mode B: Granular Package Comparison (Single Package Deep-Dive)

**Steps:**
1. **Select Base Version (A)** - e.g., `3.9.0`
2. **Select Target Version (B)** - e.g., `3.10.0`
3. **Wait for package dropdown to populate** (shows union of all packages)
4. **Select a specific package** - e.g., `@webex/calling`
5. **Pre-release version dropdowns appear automatically**
6. **Select pre-release version(s)**:
   - Base Version: e.g., `3.9.0-next.10` (optional, falls back to stable)
   - Target Version: e.g., `3.10.0-next.5` (optional, falls back to stable)
   - *At least one pre-release version must be selected*
7. **Click "Compare Versions"**
8. **View detailed results**:
   - Main package comparison
   - All packages published with those versions
   - Complete dependency view

**Example Package Comparisons:**
- Compare `webex@3.9.0-next.10` vs `webex@3.10.0-next.5`
- Compare `@webex/calling@3.9.0` vs `@webex/calling@3.10.0-next.8`
- Track pre-release version evolution across stable releases

---

## 🔗 Sharing Comparisons (Permalinks)

### Using the Share Link Feature 🆕

After performing a comparison, you can share it with others:

1. **Automatic URL Update**: The URL automatically updates when you compare versions
2. **Copy Permalink Button**: Click the "📋 Copy Permalink & share link" button to copy the URL
3. **Share the Link**: Send the link to anyone - they'll see the exact same comparison
4. **Browser Compatibility**: Fallback clipboard support for older browsers

### URL Formats Supported

The portal supports multiple URL formats for different comparison types:

#### Format 1: Full Version Comparison (Compact)
```
?compare=3.9.0vs3.10.0
```
**Example:** `http://localhost:8000/?compare=3.9.0vs3.10.0`

#### Format 2: Full Version Comparison (Explicit)
```
?versionA=3.9.0&versionB=3.10.0
```
**Example:** `http://localhost:8000/?versionA=3.9.0&versionB=3.10.0`

#### Format 3: Package-Level Comparison (Enhanced) 🆕
```
?compareStableA=3.9.0&compareStableB=3.10.0&comparePackage=webex&compareVersionA=3.9.0-next.10&compareVersionB=3.10.0-next.5
```
**Example:** `http://localhost:8000/?compareStableA=3.9.0&compareStableB=3.10.0&comparePackage=webex&compareVersionA=3.9.0-next.10&compareVersionB=3.10.0-next.5`

**Parameters:**
- `compareStableA` - Base stable version
- `compareStableB` - Target stable version
- `comparePackage` - Package name (e.g., `webex`, `@webex/calling`)
- `compareVersionA` - Specific pre-release version in base
- `compareVersionB` - Specific pre-release version in target

### Direct Access via URL

You can bookmark or share these URLs directly:

**Full Version Comparisons:**
- `?compare=3.3.1vs3.10.0` - Compare all packages between v3.3.1 and v3.10.0
- `?compare=3.9.0vs3.10.0` - Compare all packages between v3.9.0 and v3.10.0

**Package-Level Comparisons:**
- `?compareStableA=3.9.0&compareStableB=3.10.0&comparePackage=webex&compareVersionA=3.9.0-next.10&compareVersionB=3.10.0-next.5`
- `?compareStableA=3.9.0&compareStableB=3.10.0&comparePackage=@webex/calling&compareVersionA=3.9.0&compareVersionB=3.10.0`

### URL Auto-Loading Features

When someone opens a comparison URL:
- ✅ Automatically switches to "Version Comparison" mode
- ✅ Pre-selects both stable versions
- ✅ Pre-selects package (if package-level comparison)
- ✅ Pre-selects specific pre-release versions (if provided)
- ✅ Automatically fetches and displays comparison results
- ✅ Copy button appears for easy sharing
- ✅ Ready to share or bookmark immediately

---

## 🗂 File Structure

```
changelog/
├── index.html          # Main HTML file with comparison UI
├── assets/
│   ├── css/
│   │   └── app.css     # Styles including comparison styles
│   ├── js/
│   │   └── app.js      # JavaScript logic including comparison
│   └── images/
│       └── copy-icon.png
├── logs/
│   ├── main.json       # Version index
│   ├── v3_10_0.json   # Package data for v3.10.0
│   ├── v3_9_0.json    # Package data for v3.9.0
│   └── ...            # Other version files
└── README.md          # This file
```

---

## 🔧 Technical Details

### Technologies Used
- **HTML5** - Structure and semantic markup
- **CSS3** - Styling with Bootstrap 3.3.6
- **JavaScript (ES6+)** - Logic and interactions (async/await, Promises)
- **Handlebars.js 4.7.8** - Template rendering engine
- **Fetch API** - Asynchronous data loading
- **URL API** - State management and permalink generation

### How Full Version Comparison Works

1. **Data Fetching**: 
   - Uses `Promise.all()` to fetch both changelog JSON files in parallel
   - Optimal performance for large files (some >100K lines)
   - Error handling for network failures

2. **Package Extraction** (`extractPackagesFromVersion`):
   - Iterates through all packages in each changelog
   - Finds the earliest version of each package by published date
   - Handles edge cases (missing data, invalid timestamps)

3. **Union-Based Comparison** (`comparePackages`):
   - Creates a Set union of all packages from both changelogs
   - Ensures packages unique to either version are included
   - Finds earliest version for each package in each changelog

4. **Classification**: Categorizes each package as:
   - **Changed** - Different versions exist in both (different version)
   - **Unchanged** - Same version exists in both (identical)
   - **Added** - Only exists in target version B (new package)
   - **Removed** - Only exists in base version A (deprecated package)

5. **Statistical Aggregation**:
   - Counts packages in each category
   - Total package count
   - Change metrics for summary display

6. **Rendering** (`displayComparison`):
   - Handlebars template compilation
   - Color-coded table rows based on status
   - Summary statistics badges
   - Smooth scroll to results

### How Granular Package Comparison Works

1. **Smart Package Selection**:
   - After stable versions selected, fetches both changelogs
   - Extracts union of all packages using `getUnionPackages()`
   - Prioritizes common packages (`webex`, `@webex/calling`)
   - Sorts remaining packages alphabetically

2. **Pre-release Version Population** (`populatePrereleaseVersions`):
   - Filters versions matching stable version pattern (e.g., `3.9.0-*`)
   - Sorts by published date (newest first)
   - Includes stable version as fallback option
   - Handles packages not present in one version

3. **Changelog Caching**:
   - Stores fetched changelogs in memory (`cachedChangelogA`, `cachedChangelogB`)
   - Avoids redundant network requests
   - Cleared on version change or reset

4. **Deep Package Comparison** (`compareSpecificPackageVersions`):
   - Compares selected package versions
   - Extracts `alongWith` data (packages published together)
   - Searches entire changelog for related packages
   - Prioritizes `alongWith` data, falls back to changelog search
   - Creates comprehensive comparison including all dependencies

5. **Dynamic Button State** (`updateCompareButtonState`):
   - Validates form state in real-time
   - Disables button if package selected without pre-release version
   - Enables for full version comparison (no package selected)
   - Requires at least one pre-release version if package selected

6. **URL State Management**:
   - Different URL formats for full vs. package-level comparison
   - `updateEnhancedComparisonURL()` for package-level permalinks
   - Auto-loading from URL on page load with proper timing
   - Clears old parameters when switching modes

### Key Algorithms

**Union Package Detection:**
```javascript
const allPackages = new Set([
  ...Object.keys(changelogA),
  ...Object.keys(changelogB)
]);
```

**Earliest Version Finding:**
- Iterates through all versions of a package
- Compares `published_date` timestamps
- Returns version with lowest (earliest) timestamp

**Priority Sorting:**
- Special packages (`webex`, `@webex/calling`) first
- Separator for visual distinction
- Alphabetical sort for remaining packages

---

## 🐛 Troubleshooting

### General Issues

#### Issue: JSON files not loading
**Solution**: Make sure you're using a local web server (not opening the HTML file directly)

#### Issue: Styles not applying
**Solution**: Clear your browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

#### Issue: Port 8000 already in use
**Solution**: Use a different port:
```bash
python3 -m http.server 8080
```

### Full Version Comparison Issues

#### Issue: Comparison not showing packages
**Possible Causes:**
- Data fetching failed
- Template rendering error
- Empty changelog files

**Solution**: 
1. Open browser console (F12)
2. Perform a comparison
3. Check console for detailed debug logs
4. Look for errors in fetch operations
5. Verify JSON files exist in `logs/` directory

#### Issue: Wrong packages showing
**Solution**: Check that you're comparing the correct stable versions. The comparison uses the earliest version of each package by published date.

#### Issue: Comparison button disabled
**Solution**: Ensure both stable versions are selected and they are different from each other.

### Package-Level Comparison Issues

#### Issue: Package dropdown not appearing
**Possible Causes:**
- Changelogs not loaded yet
- Versions not selected
- Same version selected for both A and B

**Solution**:
1. Ensure you've selected two **different** stable versions
2. Wait a moment for changelogs to load
3. Check browser console for errors

#### Issue: Pre-release version dropdown empty
**Possible Causes:**
- Package not available in selected version
- No pre-release versions exist for that package
- Only stable version exists

**Solution**:
- The dropdown will show "Package not available in this version" if the package doesn't exist
- Try selecting a different package
- Check if the package has pre-release versions in the selected stable version

#### Issue: Compare button disabled after selecting package
**Cause**: At least one pre-release version must be selected when comparing packages

**Solution**:
1. Select at least one pre-release version (either A or B or both)
2. Leave package dropdown empty for full version comparison
3. The button enables when valid selections are made

#### Issue: Pre-release dropdown shows "No versions found"
**Cause**: The selected package may not have any versions in that stable release

**Solution**: Try a different package that exists in both versions

### Permalink/Sharing Issues

#### Issue: Copy link button not working
**Solutions**:
1. Check browser console for clipboard API errors
2. Try manually copying from address bar
3. Fallback method will trigger automatically
4. Ensure you're on HTTPS or localhost (clipboard API restriction)

#### Issue: Shared link doesn't auto-load comparison
**Possible Causes:**
- URL parameters malformed
- Version doesn't exist
- Timing issue on page load

**Solution**:
1. Verify URL parameters are correct
2. Check browser console for loading errors
3. Try refreshing the page
4. Manually select versions if auto-load fails

### Debug Mode

**Enable detailed logging:**
1. Open browser console (F12)
2. Check for console.log outputs:
   - `packagesA` and `packagesB` - Extracted packages
   - `comparisonData` - Comparison results
   - `allPackageNames` - Union of packages
   - Template data and HTML generation logs

**Common console messages:**
- "Total packages to compare: X" - Shows union package count
- "Template data:" - Shows data passed to Handlebars
- "Comparison displayed successfully" - Confirms successful render

---

## 🔍 Debugging Tools

### Test Page
**Location:** `test-comparison.html`

Automated diagnostic page that checks:
- ✅ Data file loading
- ✅ Version paths population  
- ✅ Template existence
- ✅ Function availability

**Usage:**
```bash
open http://localhost:8000/test-comparison.html
```

### Debug Logging
Comprehensive console logging is enabled in `app.js`:
- Tracks comparison execution step-by-step
- Logs data at each stage
- Shows detailed error messages

**See:** `DEBUG_INSTRUCTIONS.md` for complete guide

---

## 📝 Future Enhancements

**Completed Features:**
- [x] **URL parameters for shareable comparisons** ✅ (Implemented!)
- [x] **Package-level granular comparison** ✅ (Implemented!)
- [x] **Pre-release version comparison** ✅ (Implemented!)
- [x] **Union-based package detection** ✅ (Implemented!)
- [x] **Clipboard API with fallback** ✅ (Implemented!)
- [x] **Dynamic form validation** ✅ (Implemented!)
- [x] **Changelog caching** ✅ (Implemented!)

**Potential Future Enhancements:**
- [ ] Export comparison results as CSV/JSON
- [ ] Commit-level diff view between package versions
- [ ] Filter comparison results by change type (Added/Removed/Changed)
- [ ] Search/filter within comparison results
- [ ] Dark mode support
- [ ] Highlight specific packages in comparison
- [ ] Compare more than two versions side-by-side (matrix view)
- [ ] Visual diff for breaking changes
- [ ] Dependency graph visualization
- [ ] Historical version timeline
- [ ] Batch comparison (compare multiple packages at once)
- [ ] Comparison history/favorites
- [ ] Email/Slack integration for sharing
- [ ] API endpoint for programmatic comparisons

---

## 👨‍💻 Development

### Files Modified for Version Comparison Feature

#### 1. **index.html**
- Added mode toggle buttons (Single View / Comparison View)
- Comparison form with dynamic dropdowns
- Package selection row (hidden by default)
- Pre-release version selection row (conditional display)
- Copy permalink button
- Helper text for sharing
- Comparison results container
- Handlebars template for comparison rendering

#### 2. **app.css**
- Mode toggle button styles (active/inactive states)
- Comparison form layout (responsive grid)
- Color-coded table rows:
  - `.version-changed` - Yellow highlight
  - `.only-in-a` - Red highlight (removed)
  - `.only-in-b` - Green highlight (added)
  - `.unchanged` - Default styling
- Summary statistics badges
- Copy button styling with hover effects
- Responsive design for mobile devices

#### 3. **app.js** - Core Comparison Functions

**Full Version Comparison:**
- `extractPackagesFromVersion(changelog, specificVersions)` - Extract packages from changelog
- `comparePackages(packagesA, packagesB, changelogA, changelogB)` - Compare two package sets
- `performVersionComparison(versionA, versionB)` - Main comparison orchestrator
- `displayComparison(versionA, versionB, comparisonData)` - Render comparison results
- `handleComparisonURLParams()` - Parse comparison URLs

**Granular Package Comparison:**
- `getUnionPackages(changelogA, changelogB)` - Get all packages from both versions
- `populateUnionPackages(changelogA, changelogB)` - Populate package dropdown
- `populatePrereleaseVersions(packageName, changelog, selectId, stableVersion)` - Populate pre-release versions
- `compareSpecificPackageVersions(packageName, versionA, versionB, changelogA, changelogB)` - Deep package comparison
- `findLatestPackageVersion(changelog, packageName)` - Find latest version in changelog
- `findEarliestPackageVersion(changelog, packageName)` - Find earliest version in changelog
- `updateCompareButtonState()` - Dynamic button validation
- `handleEnhancedComparisonURL()` - Parse enhanced comparison URLs
- `updateEnhancedComparisonURL(stableA, stableB, packageName, versionA, versionB)` - Generate enhanced permalinks

**Utility Functions:**
- `initializeComparisonMode()` - Setup event handlers and mode switching
- `switchToComparisonMode(versionA, versionB)` - Programmatic mode switch
- `copyComparisonLink()` - Copy permalink to clipboard
- `showCopySuccess(button)` - Visual feedback on copy
- `fallbackCopyToClipboard(text, button)` - Legacy browser support
- `updateComparisonURL(versionA, versionB)` - Update URL for sharing
- `initializeApplication()` - Proper initialization order

**State Management:**
- `comparisonMode` - Boolean flag for current mode
- `cachedChangelogA` / `cachedChangelogB` - In-memory changelog cache
- `currentStableA` / `currentStableB` - Track current stable selections
- `versionPaths` - Map of version names to file paths

### Code Architecture

**Event-Driven Design:**
- Form submission handlers prevent default behavior
- Change listeners on all form elements
- Real-time validation feedback
- Asynchronous data loading with loading states

**Error Handling:**
- Try-catch blocks around async operations
- User-friendly error messages
- Console logging for debugging
- Graceful degradation for missing data

**Performance Optimizations:**
- Parallel data fetching with `Promise.all()`
- Changelog caching to avoid redundant requests
- Debounced form state updates
- Lazy loading of package dropdowns

---

## 📚 Quick Reference Guide

### When to Use Full Version Comparison
✅ Need to see **all packages** changed between releases  
✅ Want overall statistics across the entire SDK  
✅ Comparing major version updates  
✅ Understanding broad scope of changes  

### When to Use Package-Level Comparison
✅ Investigating a **specific package** in detail  
✅ Comparing **pre-release versions** (e.g., next.X)  
✅ Tracking a package's evolution across stable releases  
✅ Need to see all packages published **alongside** a specific version  

### URL Format Quick Reference

| Comparison Type | URL Format | Example |
|----------------|------------|---------|
| Full Version (Compact) | `?compare=AvB` | `?compare=3.9.0vs3.10.0` |
| Full Version (Explicit) | `?versionA=X&versionB=Y` | `?versionA=3.9.0&versionB=3.10.0` |
| Package-Level | `?compareStableA=X&compareStableB=Y&comparePackage=Z&compareVersionA=A&compareVersionB=B` | `?compareStableA=3.9.0&compareStableB=3.10.0&comparePackage=webex&compareVersionA=3.9.0-next.10&compareVersionB=3.10.0-next.5` |

### Color Code Legend

| Color | Status | Meaning |
|-------|--------|---------|
| 🟡 Yellow | Version Changed | Package exists in both versions but with different version numbers |
| 🟢 Green | Added | Package only exists in target version (new in B) |
| 🔴 Red | Removed | Package only exists in base version (removed in B) |
| ⚪ White | Unchanged | Package has same version in both releases |

---

## 📧 Support

For issues or questions, please contact the Webex JS SDK team.

---

**Enjoy comparing SDK versions! 🎉**

