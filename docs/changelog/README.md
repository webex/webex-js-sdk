# Webex JS SDK Changelog Portal

This is the changelog portal for the Webex JS SDK. It now includes a **Version Comparison** feature that allows users to compare packages between two SDK versions.

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

### 2. **Version Comparison (New Feature)** 🆕
- Select two SDK versions to compare
- See side-by-side package lists
- Color-coded differences:
  - 🟡 **Yellow**: Version changed between the two releases
  - 🔴 **Red**: Package removed in the target version
  - 🟢 **Green**: Package added in the target version
  - ⚪ **White**: Package unchanged
- Summary statistics showing:
  - Total packages
  - Number of changed packages
  - Number of unchanged packages
  - Packages added/removed

---

## 📖 How to Use Version Comparison

1. **Start the local server** using one of the methods above
2. **Open the changelog portal** in your browser
3. **Click "Version Comparison"** button at the top
4. **Select Base Version (A)** - The version you want to compare from
5. **Select Target Version (B)** - The version you want to compare to
6. **Click "Compare Versions"**
7. **View the results** - See all packages and their version differences

### Example Comparisons to Try:
- Compare `3.9.0` vs `3.10.0` - See what changed in the latest release
- Compare `3.3.1` vs `3.10.0` - See all changes across multiple releases
- Compare any two versions to understand package evolution

---

## 🔗 Sharing Comparisons (Permalinks)

### Using the Share Link Feature 🆕

After performing a comparison, you can share it with others:

1. **Automatic URL Update**: The URL automatically updates when you compare versions
2. **Copy Share Link Button**: Click the "📋 Copy Share Link" button to copy the URL
3. **Share the Link**: Send the link to anyone - they'll see the exact same comparison

### URL Formats Supported

The portal supports multiple URL formats for comparisons:

#### Format 1: Compact Format (Recommended)
```
?compare=3.9.0vs3.10.0
```
**Example:** `http://localhost:8000/?compare=3.9.0vs3.10.0`

#### Format 2: Explicit Format
```
?versionA=3.9.0&versionB=3.10.0
```
**Example:** `http://localhost:8000/?versionA=3.9.0&versionB=3.10.0`

### Direct Access via URL

You can bookmark or share these URLs directly:
- `?compare=3.3.1vs3.10.0` - Compare v3.3.1 with v3.10.0
- `?compare=3.9.0vs3.10.0` - Compare v3.9.0 with v3.10.0

When someone opens a comparison URL:
- ✅ Automatically switches to "Version Comparison" mode
- ✅ Pre-selects both versions
- ✅ Automatically displays the comparison results
- ✅ Ready to share or bookmark

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
- **HTML5** - Structure
- **CSS3** - Styling with Bootstrap 3.3.6
- **JavaScript (ES6+)** - Logic and interactions
- **Handlebars.js 4.7.8** - Templating
- **Fetch API** - Data loading

### How Version Comparison Works
1. **Data Fetching**: Fetches JSON files for both selected versions in parallel
2. **Package Extraction**: Extracts the latest version of each package from the changelog
3. **Comparison Algorithm**: Compares package versions between the two releases
4. **Classification**: Categorizes each package as:
   - Changed (different version)
   - Unchanged (same version)
   - Added (only in target version)
   - Removed (only in base version)
5. **Rendering**: Displays results in a color-coded table with statistics

---

## 🐛 Troubleshooting

### Issue: JSON files not loading
**Solution**: Make sure you're using a local web server (not opening the HTML file directly)

### Issue: Styles not applying
**Solution**: Clear your browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

### Issue: Comparison button not working
**Solution**: Check the browser console (F12) for JavaScript errors

### Issue: Port 8000 already in use
**Solution**: Use a different port:
```bash
python3 -m http.server 8080
```

---

## 📝 Future Enhancements

- [ ] Export comparison results as CSV/JSON
- [ ] Detailed diff view for individual packages
- [ ] Filter comparison results by change type
- [ ] Search within comparison results
- [x] **URL parameters for shareable comparisons** ✅ (Implemented!)
- [ ] Dark mode support
- [ ] Highlight specific packages in comparison
- [ ] Compare more than two versions side-by-side

---

## 👨‍💻 Development

### Files Modified for Version Comparison Feature:
1. **index.html** - Added mode toggle, comparison form, and results container
2. **app.css** - Added comparison styles and color coding
3. **app.js** - Added comparison logic functions:
   - `extractPackagesFromVersion()` - Extract packages from changelog
   - `comparePackages()` - Compare two package sets
   - `performVersionComparison()` - Main comparison function
   - `displayComparison()` - Render comparison results
   - `initializeComparisonMode()` - Setup event handlers

---

## 📧 Support

For issues or questions, please contact the Webex JS SDK team.

---

**Enjoy comparing SDK versions! 🎉**

