# Webex JS SDK Changelog Portal

A changelog portal for the Webex JS SDK with version comparison capabilities.

## Quick Start

Start a local server and open in browser:

```bash
cd docs/changelog
python3 -m http.server 8000
# Open http://localhost:8000
```

## Features

1. **Single Version View** - Search by package, version, commit message, or hash
2. **Full Version Comparison** - Compare all packages between two SDK versions
3. **Package-Level Comparison** - Deep-dive into specific packages with pre-release version support

---

## File Structure

```
changelog/
├── index.html              # Main HTML file
├── assets/
│   ├── css/app.css        # Styles (CSS variables, comparison UI)
│   ├── js/app.js          # Application logic
│   └── images/
├── logs/
│   ├── main.json          # Version index
│   └── v*.json            # Version-specific changelog data
└── README.md
```

## Architecture

### Tech Stack
- HTML5, CSS3 (CSS Variables), JavaScript ES6+
- Handlebars.js for templating
- Fetch API for data loading
- Bootstrap 3 for UI components

### Code Organization

**app.js** is organized into layers:

1. **DOM Elements** (Top) - All query selectors defined once at initialization
2. **UI Helper Functions** - Pure presentation logic (loading, error display)
3. **Data Layer Functions** - Pure data processing (no DOM manipulation)
   - `fetchAndCompareVersions()` - Fetch and process data
   - `generatePackageComparisonData()` - Generate comparison data
   - Modular helpers: `findLatestPackageVersion()`, `getEffectiveVersion()`, `determinePackageStatus()`, etc.
4. **UI Layer Functions** - Orchestrate data + presentation
   - `performVersionComparison()` - Fetch data → Display UI
   - `compareSpecificPackageVersions()` - Generate data → Render template
5. **Event Handlers** - User interactions and form validation

**Separation of Concerns:**
- Data functions return objects, throw errors (no alerts/DOM)
- UI functions handle DOM manipulation, user feedback
- Pure functions are testable and reusable

### Data Flow

#### Single Version View
```
User selects version → Fetch changelog JSON → Filter by search params → Render results
```

#### Full Version Comparison
```
Select versions A & B → Fetch both changelogs (parallel) → 
Extract packages → Compare versions → Calculate stats → Render table
```

#### Package-Level Comparison
```
Select stable versions → Fetch changelogs → Populate package dropdown →
User selects package → Populate pre-release versions (filtered by stable version) →
User selects versions → Generate comparison data → Render results
```

### Key Concepts

**Version Selection Logic:**
- Stable versions determine which JSON files to load
- Pre-release versions are filtered using `.startsWith(stableVersion + '-')`
- Sorted by `published_date` (newest first for pre-release, earliest first for comparison)

**Package Comparison:**
- Uses Set union to get all packages from both versions
- Status: `Added`, `Removed`, `Version Changed`, `Unchanged`
- Prioritizes `alongWith` data, falls back to changelog search

**State Management:**
- `versionPaths` - Maps version names to JSON file paths
- `currentChangelog` - Currently loaded changelog
- `cachedChangelogA/B` - Cached changelogs for comparison mode
- URL parameters for bookmarkable state

---

## Support

For issues or questions, contact the Webex JS SDK team.