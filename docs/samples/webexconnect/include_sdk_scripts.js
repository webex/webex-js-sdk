(async function include_sdk_source_files() {
    let appConfig = await fetch("app.config.json").then(response => response.json());
    let env = appConfig["sourceCodeType"] || IMISourceCodeType.Source;

    if (appConfig.includeFirebaseScripts) {
        const FIREBASE_SOURCE_FILES = [
            "https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js",
            "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js"
        ];
        for (let i = 0; i < FIREBASE_SOURCE_FILES.length; i++) {
            appendScriptTag(FIREBASE_SOURCE_FILES[i]);
        }

    }


    const IMISourceCodeType = { Minified: "minified", Source: "source" };

    // Canonical build, produced by `packages/webexconnect` and copied here by its
    // build (see packages/webexconnect/scripts/sync-sample.js). The sample no longer
    // vendors its own SDK source — there is a single IMIClient.js under packages/.
    const MINIFIED_SDK_FILES = ["webex-connect-sdk.min.js"];
    const SOURCE_SDK_FILES = MINIFIED_SDK_FILES;



    let selectedSourceFiles;
    if (env === IMISourceCodeType.Minified)
        selectedSourceFiles = MINIFIED_SDK_FILES;
    else
        selectedSourceFiles = SOURCE_SDK_FILES;

    let lastScript;
    for (let i = 0; i < selectedSourceFiles.length; i++) {
        lastScript = appendScriptTag(selectedSourceFiles[i]);
    }
    if (lastScript) {
        lastScript.addEventListener('load', function () {
            document.dispatchEvent(new Event('IMISdkReady'));
        });
    }

    function appendScriptTag(src) {
        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.type = 'text/javascript';
        // Dynamically-inserted scripts default to async=true; force ordered
        // execution so firebase-app loads before firebase-messaging and
        // IMIClient.js loads before any custom element that references IMI.
        script.async = false;
        script.src = src;
        head.appendChild(script);
        return script;
    }
    console.debug('completed including sdk ' + env + ' files');

})();