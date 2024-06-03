const { startServer, stopServer } = require('@webex/legacy-tools');
const { exec } = require('child_process');

describe('Test Server Integration Tests', () => {
  let child;
  beforeAll(async () => {
    child = await startServer();
  });

  it('should start the test server', (done) => {
    // Check if the server process is started
    expect(child.port).not.toBe(null);

    exec('lsof -i :8000', (error, stdout) => {
      expect(error).toBe(null);
      expect(stdout).toContain('LISTEN');
      done();
    });
  }, 10000);

  it('should stop the child if its already started', (done) => {
    startServer().then((process) => {
      // makes sure a new process is started all time
      expect(process.pid).not.toEqual(child.pid);
      exec('lsof -i :8000', (error, stdout) => {
        expect(stdout).toContain('LISTEN');
        done();
      });
    }).catch(fail);
  }, 10000);

  it('should stop the test server', (done) => {
    stopServer().then((process) => {
      expect(process).toBe(null);
      // Optionally, check that the server is no longer listening on the port
      exec('lsof -i:8000', (error, stdout, stderr) => {
        expect(stderr).toEqual('');
        done();
      });
    }).catch(fail);
  }, 10000);
});
