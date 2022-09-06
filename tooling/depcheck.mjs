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
          new Promise((res, reject) => {
          fullList[path].using.forEach((dep, index) =>{
            const key = `"`+dep+`"`;
              if(globalParsedPackages["devDependencies"][dep]) {
                devDependencies[key] = globalParsedPackages["devDependencies"][dep]
              } else if(globalParsedPackages["dependencies"][dep]) {
                dependencies[key] = globalParsedPackages["dependencies"][dep] +''
              } else if(dep.match(/webex\//)) {
                dependencies[key] = "workspace^"
              }
              if(index === (fullList[path].using.length -1)) res();
          })
        }).then(() =>{
          parsedPackages.devDependencies = devDependencies;
          parsedPackages.dependencies = dependencies;

          let data = JSON.stringify(parsedPackages);
          fs.writeFileSync(fullpath+'/package.json', data);
        })


          if(Object.keys(fullList).length === files.length) resolve();
  
        })

      })

  })
  
  done.then(() =>{

    let data = JSON.stringify(fullList);
    fs.writeFileSync('depcheck-result.json', data);
  })


})
