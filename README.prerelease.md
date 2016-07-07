# Internal Pre-release Distribution

1. Install dependencies and npm link relevant packages
```bash
./cisco-live-prerelease.sh
```
2. Link dependencies into your project:
```bash
cd /path/to/your/project
npm link @ciscospark/phone
```
3. Import spark into your code
```javascript
var ciscospark = require('@ciscospark/phone').default;
ciscospark.phone.register()
  .then(function() {
    var call = ciscospark.phone.dial('alice@example.com');
  });
```
