# Version Comparison Permalink Examples

This document provides examples of comparison permalink URLs that you can use to directly access version comparisons.

## 🔗 Quick Access Links

### Recent Version Comparisons

#### Latest Release Comparison
```
http://localhost:8000/?compare=3.9.0vs3.10.0
```
**What it shows:** Changes between v3.9.0 and v3.10.0

#### Major Version Jump
```
http://localhost:8000/?compare=3.3.1vs3.10.0
```
**What it shows:** All changes from v3.3.1 to v3.10.0 (multiple releases)

#### Sequential Versions
```
http://localhost:8000/?compare=3.8.0vs3.9.0
```
**What it shows:** Changes between v3.8.0 and v3.9.0

---

## 📝 URL Format Specifications

### Format 1: Compact Format (Recommended)
**Pattern:** `?compare={versionA}vs{versionB}`

**Examples:**
```
?compare=3.9.0vs3.10.0
?compare=3.3.1vs3.10.0
?compare=1.0.0vs3.10.0
```

**Advantages:**
- ✅ Shorter URL
- ✅ Easy to remember
- ✅ Clean and readable
- ✅ Easy to share

### Format 2: Explicit Parameters
**Pattern:** `?versionA={version1}&versionB={version2}`

**Examples:**
```
?versionA=3.9.0&versionB=3.10.0
?versionA=3.3.1&versionB=3.10.0
?versionA=1.0.0&versionB=3.10.0
```

**Advantages:**
- ✅ Self-documenting
- ✅ Clear parameter names
- ✅ Compatible with URL builders

---

## 🧪 Testing the Permalink Feature

### Test Case 1: Direct URL Access
1. Start the local server
2. Copy and paste this URL in your browser:
   ```
   http://localhost:8000/?compare=3.9.0vs3.10.0
   ```
3. **Expected Result:**
   - Portal loads in "Version Comparison" mode
   - Version A dropdown shows "3.9.0"
   - Version B dropdown shows "3.10.0"
   - Comparison results are automatically displayed

### Test Case 2: Sharing a Comparison
1. Start the local server
2. Open: `http://localhost:8000/`
3. Click "Version Comparison"
4. Select versions: 3.9.0 and 3.10.0
5. Click "Compare Versions"
6. Click "📋 Copy Share Link" button
7. Open a new browser tab/window
8. Paste the URL
9. **Expected Result:**
   - Same comparison loads automatically
   - All data matches the original comparison

### Test Case 3: Bookmark Functionality
1. Perform a comparison (e.g., 3.9.0 vs 3.10.0)
2. Bookmark the page (Cmd+D / Ctrl+D)
3. Close the browser
4. Open browser and navigate to the bookmark
5. **Expected Result:**
   - Comparison loads automatically from the bookmarked URL

### Test Case 4: URL Modification
1. Start with: `?compare=3.9.0vs3.10.0`
2. Manually change to: `?compare=3.8.0vs3.9.0`
3. Press Enter
4. **Expected Result:**
   - New comparison (3.8.0 vs 3.9.0) loads automatically

---

## 🎯 Use Cases

### For Developers
**Scenario:** You want to quickly check what changed between versions
```
Bookmark: ?compare=3.9.0vs3.10.0
```

### For Documentation
**Scenario:** Add comparison links to release notes
```
See what changed: [v3.9.0 vs v3.10.0](http://localhost:8000/?compare=3.9.0vs3.10.0)
```

### For Team Communication
**Scenario:** Share specific comparisons in Slack/Teams
```
Hey team, check out the changes: http://localhost:8000/?compare=3.9.0vs3.10.0
```

### For Bug Investigation
**Scenario:** Identify when a package version changed
```
Compare versions where bug appeared:
?compare=3.8.0vs3.9.0
```

---

## 🔍 Advanced Usage

### Combining with Browser Features

#### Browser History
- The URL updates automatically when you perform comparisons
- Use browser back/forward buttons to navigate between comparisons

#### Share Button (Mobile)
- On mobile browsers, use the native share button
- The current comparison URL will be shared

#### QR Code Generation
- Generate QR codes from comparison URLs
- Useful for presentations or documentation

---

## ⚠️ Important Notes

1. **Valid Versions Only**
   - Only versions that exist in the changelog can be compared
   - Invalid versions will show an error

2. **URL Precedence**
   - Comparison parameters (`?compare=`) take precedence over single-view parameters
   - If both are present, comparison mode is used

3. **Auto-Switch Mode**
   - When comparison parameters are detected, the portal automatically switches to "Version Comparison" mode
   - No manual mode switching needed

4. **URL Updates**
   - When you perform a comparison via the UI, the URL automatically updates
   - You don't need to manually construct the URL

---

## 🐛 Troubleshooting

### Issue: Comparison doesn't load automatically
**Possible Causes:**
- Invalid version numbers in URL
- Version data not yet loaded
- Network issues fetching changelog data

**Solution:**
- Check if versions exist in the version dropdown
- Wait a few seconds and refresh
- Check browser console for errors

### Issue: URL doesn't update after comparison
**Possible Causes:**
- JavaScript error in console
- Browser doesn't support History API

**Solution:**
- Check browser console for errors
- Try a modern browser (Chrome, Firefox, Safari)
- Manually construct the URL if needed

### Issue: Copied link doesn't work for others
**Possible Causes:**
- Using localhost URL (only works on your machine)
- Portal not deployed to a public server

**Solution:**
- For production: Replace `localhost:8000` with your actual domain
- For local sharing: Both users need to run the server locally

---

## 📊 Example Comparisons by Version

### All Available Comparisons

Based on the available versions in your changelog:

```
Version 0.0.0 to 0.0.1:    ?compare=0.0.0vs0.0.1
Version 0.0.1 to 1.0.0:    ?compare=0.0.1vs1.0.0
Version 1.0.0 to 3.3.1:    ?compare=1.0.0vs3.3.1
Version 3.3.1 to 3.4.0:    ?compare=3.3.1vs3.4.0
Version 3.4.0 to 3.5.0:    ?compare=3.4.0vs3.5.0
Version 3.5.0 to 3.6.0:    ?compare=3.5.0vs3.6.0
Version 3.6.0 to 3.7.0:    ?compare=3.6.0vs3.7.0
Version 3.7.0 to 3.8.0:    ?compare=3.7.0vs3.8.0
Version 3.8.0 to 3.8.1:    ?compare=3.8.0vs3.8.1
Version 3.8.1 to 3.9.0:    ?compare=3.8.1vs3.9.0
Version 3.9.0 to 3.10.0:   ?compare=3.9.0vs3.10.0
```

### Major Milestone Comparisons

```
Initial to Latest:        ?compare=0.0.0vs3.10.0
v1 to Latest:             ?compare=1.0.0vs3.10.0
v3 Start to Latest:       ?compare=3.3.1vs3.10.0
```

---

**Happy Comparing! 🎉**

