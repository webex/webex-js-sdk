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

1. **Single Version View** — Search by package, version, commit message, or hash
2. **Package-Level Comparison** — Compare specific packages across stable versions with pre-release version support, cross-stable commit collection, and shareable permalinks

---

## File Structure

```
changelog/
├── index.html              # Main HTML file
├── assets/
│   ├── css/app.css         # Styles (CSS variables, comparison UI, Webex watermark)
│   ├── js/app.js           # Application logic
│   └── images/
│       └── webex.png       # Webex logo (used as subtle background watermark)
├── logs/
│   ├── main.json           # Version index
│   └── v*.json             # Version-specific changelog data
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

1. **DOM Elements** (Top) — All query selectors defined once at initialization
2. **UI Helper Functions** — Pure presentation logic (loading, error display)
3. **Data Layer Functions** — Pure data processing (no DOM manipulation)
   - `generatePackageComparisonData()` — Generate comparison data
   - `collectCommitsAcrossStables()` — Walk stable versions between base and target, fetch intermediate changelogs in parallel, and collect commits
   - `collectCommitsFromStable()` — Collect commits from a single stable based on position (start/middle/end/only) and version range
   - Modular helpers: `findLatestPackageVersion()`, `getEffectiveVersion()`, `determinePackageStatus()`, `isPreRelease()`, `isExactStable()`, `getPreReleaseTag()`, `getPreReleaseNum()`, etc.
4. **UI Layer Functions** — Orchestrate data + presentation
   - `compareSpecificPackageVersions()` — Generate data → Render template
   - `populateUnionPackages()` — Build package dropdown with special packages prioritized
   - `populatePrereleaseVersions()` — Build pre-release dropdown with optional stable exclusion
5. **Event Handlers** — User interactions, form validation, and URL-based state restoration

**Separation of Concerns:**
- Data functions return objects, throw errors (no alerts/DOM)
- UI functions handle DOM manipulation, user feedback
- Pure functions are testable and reusable

### Data Flow

#### Single Version View
```
User selects version → Fetch changelog JSON → Filter by search params → Render results
```

#### Package-Level Comparison
```
Select stable versions → Fetch changelogs (parallel if different, single fetch if same) →
Populate package dropdown (special packages first) →
User selects package → Populate pre-release versions (filtered by stable) →
User selects versions → Collect commits across all stables between base & target →
Generate comparison data → Render results → Enable copy permalink
```

### Key Concepts

**Version Selection Logic:**
- Stable versions determine which JSON files to load
- Pre-release versions are filtered using `version.startsWith(stableVersion + '-')`
- Sorted by `published_date` (newest first for pre-release, earliest first for comparison)
- When base and target share the same stable version, the target pre-release dropdown excludes the stable entry to prevent identical selections

**Special Packages:**
- `webex`, `@webex/calling`, and `@webex/contact-center` are prioritized at the top of the package dropdown, separated from the rest by a visual divider

**Cross-Stable Commit Collection:**
- When comparing across multiple stable versions (e.g., 3.6.0 → 3.10.0), intermediate changelogs are fetched in parallel via `Promise.all`
- Commit positions determine filtering rules:
  - `start` — If versionA is the stable itself, include stable commits; if a pre-release, include from that pre-release onwards
  - `middle` — Include all pre-release commits for intermediate stables
  - `end` — If versionB is the stable itself, include stable commits; if a pre-release, include up to that pre-release
  - `only` — Both versions are within the same stable; apply range-based filtering
- Commits from different pre-release tags (e.g., `next` vs `multipleLLM`) are always included since alternate streams ship in the final stable release

**Package Comparison:**
- Uses Set union to get all packages from both versions
- Status: `Added`, `Removed`, `Version Changed`, `Unchanged`
- Prioritizes `alongWith` data, falls back to changelog search

**State Management:**
- `versionPaths` — Maps version names to JSON file paths
- `currentChangelog` — Currently loaded changelog
- `comparisonState.cachedChangelogA/B` — Cached changelogs for comparison mode
- URL parameters for bookmarkable/shareable state (copy permalink button)

**Permalink & URL Loading:**
- `updateEnhancedComparisonURL()` writes comparison parameters to the URL
- `loadEnhancedComparisonFromURL()` restores comparison state from URL parameters, with version order validation to reject hand-crafted URLs with flipped versions

**Security:**
- `github_linking` Handlebars helper escapes HTML entities (`&`, `<`, `>`, `"`) before injecting PR links, preventing XSS from malicious commit messages
- Fetch responses are checked with `res.ok` before parsing JSON to surface meaningful errors instead of `SyntaxError`
- Null guards protect DOM element access throughout URL-based state restoration

---

## Support

For issues or questions, contact the Webex JS SDK team.