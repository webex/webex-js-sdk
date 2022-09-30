import depcheck from 'depcheck';
import {join} from 'path'
import fs from 'fs';
//joining path of directory 
const directoryPath = join('packages', '@webex');
const options = {
  ignoreBinPackage: false, // ignore the packages with bin entry
  skipMissing: false, // skip calculation of missing dependencies
  ignorePatterns: [
    // files matching these patterns will be ignored
    'sandbox',
    'dist',
    'bower_components',
  ],
  ignoreMatches: [
    // ignore dependencies that matches these globs
    'grunt-*',
  ],
  parsers: {
    // the target parsers
    '**/*.js': depcheck.parser.es6,
    '**/*.jsx': depcheck.parser.jsx,
  },
  detectors: [
    // the target detectors
    depcheck.detector.requireCallExpression,
    depcheck.detector.importDeclaration,
  ],
  specials: [
    // the target special parsers
    depcheck.special.eslint,
    depcheck.special.webpack,
  ],
  package: {
    // may specify dependencies instead of parsing package.json
    dependencies: {
      lodash: '^4.17.15',
    },
    devDependencies: {
      eslint: '^6.6.0',
    },
    peerDependencies: {},
    optionalDependencies: {},
  },
};

fs.readdir(directoryPath, function (err, files) {
  const fullList = {}
  let done = new Promise((resolve, reject) => {
    files.forEach((path) =>{
      const fullpath = join(directoryPath, path)
  
      depcheck(fullpath, options).then((unused) => {
       
          console.log("PATH" ,path)
          fullList[path] = {
            dependencies : Object.keys(unused.dependencies),
            devDependencies : Object.keys(unused.devDependencies),
            missing : Object.keys(unused.missing),
            using : Object.keys(unused.using),
            invalidFiles : Object.keys(unused.invalidFiles), 
            invalidDirs : Object.keys(unused.invalidDirs),
          }

          let currentPackageJson = fs.readFileSync(fullpath+'/package.json');
          let parsedPackages = JSON.parse(currentPackageJson);

          let globalpackage = fs.readFileSync('globaldep.json');
          let globalParsedPackages = JSON.parse(globalpackage);

          let devDependencies = {}
          let dependencies = {}
          fullList[path].using.forEach((dep) =>{
              if(globalParsedPackages["devDependencies"][dep]) {
                devDependencies[path] = globalParsedPackages["devDependencies"][dep]
              } else if(globalParsedPackages["dependencies"][dep]) {
                dependencies[path] = globalParsedPackages["dependencies"][dep]
              } else if(x.match(/webex\//)) {
                dependencies[path] = "workspace^"
              }
          })
          parsedPackages.devDependencies = devDependencies;
          parsedPackages.dependencies = dependencies;

          console.log(parsedPackages.dependencies)

          if(Object.keys(fullList).length === files.length) resolve();
  
        })

      })

  })
  
  done.then(() =>{

    console.log("RESSS ", fullList)

    let data = JSON.stringify(fullList);
    fs.writeFileSync('depcheck-result.json', data);
  })


})
