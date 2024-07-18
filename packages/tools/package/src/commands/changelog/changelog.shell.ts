const { exec } = require('child_process');

/**
 * Function to execute shell command and capture output
 * @param scriptPath - Path to the script which we want to run.
 * @returns - Promise that resolves once the script is run and returns the output.
 */
export function runShellScript(scriptPath: string) {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing script: ${error}`);
        reject(error);
      } else if (stderr) {
        console.error(`Script stderr: ${stderr}`);
        reject(stderr);
      } else {
        // Process the stdout (output) as needed
        resolve(stdout);
      }
    });
  });
}
