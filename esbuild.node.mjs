import {build} from 'esbuild';
import os from 'os'
import glob from 'tiny-glob';
import resolve from 'esbuild-plugin-resolve';
import alias from 'esbuild-plugin-alias';
import babel from 'esbuild-plugin-babel';
import {commonjs} from '@hyrious/esbuild-plugin-commonjs';


//requiring path and fs modules
 import {join} from 'path'
import fs from 'fs';
//joining path of directory 
const directoryPath = join('packages', '@webex');

// https:// github.com/evanw/esbuild/issues/90
(async () => {
  let entryPoints = [];
  let buildAll = []
  //passsing directoryPath and callback function
  fs.readdir(directoryPath, function (err, files) {
      //handling error
      if (err) {
          return console.log('Unable to scan directory: ' + err);
      } 
      files.forEach(function (file) {
          // Do whatever you want to do with the file
          console.log(join(directoryPath, file))
          buildAll.push(build({
            entryPoints: [`${join(directoryPath, file, 'src', 'index.js')}`] ,
            // bundle: false,
            platform: 'node',
            plugins: [babel()],
            tsconfig: './tsconfig.json', // As it runs on node all of the packages are present
            // external: ['require', 'fs', 'path', 'os', 'https', 'gm', "crypto","zlib","http"],
            outdir:`${join(directoryPath, file, 'dist')}`,
          }))
      });
      
  });
  // TODO: change the entry point and change to promise , Also move the tsconfig to the plugin meetings
  // TODO: Check the build file
  // TODO: do we need to use babel at this stage ? 

  await Promise.all(buildAll)
})();
