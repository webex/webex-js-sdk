const { startServer, stopServer } = require('@webex/legacy-tools');
const { exec } = require('child_process');

describe('Test Server Integration Tests', () => {
  let child;

  it('should start the test server', async () => {
    await startServer();
    // Check if the server process is started
    expect(child).not.toBe(null);

    exec('lsof -i :PORT', (error, stdout) => { // Replace PORT with actual port number
      expect(error).toBe(null);
      expect(stdout).toContain('LISTEN');
    });
  }, 10000);

  it('should stop the test server', async () => {
    await stopServer().then(() => {
      // Optionally, check that the server is no longer listening on the port
      exec('lsof -i :PORT', (error, stdout, stderr) => { // Replace PORT with actual port number
        expect(stderr).toContain('No such file or directory');
      });
    }).catch(fail);
  }, 10000);
});
