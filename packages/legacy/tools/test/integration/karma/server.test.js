const {
  startServer, stopServer, findWorkspaceRoot, getServerPath,
} = require('@webex/legacy-tools');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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

describe('Workspace Detection Tests', () => {
  describe('findWorkspaceRoot', () => {
    it('should find workspace root from current directory', () => {
      const workspaceRoot = findWorkspaceRoot();

      expect(workspaceRoot).toBeDefined();
      expect(typeof workspaceRoot).toBe('string');

      // Verify it contains package.json with workspaces
      const packageJsonPath = path.join(workspaceRoot, 'package.json');

      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.workspaces).toBeDefined();
    });

    it('should find workspace root from a subdirectory', () => {
      const subdirectory = path.join(process.cwd(), 'packages', 'legacy', 'tools');
      const workspaceRoot = findWorkspaceRoot(subdirectory);

      expect(workspaceRoot).toBeDefined();
      expect(typeof workspaceRoot).toBe('string');

      // Should not be the same as the subdirectory
      expect(workspaceRoot).not.toBe(subdirectory);

      // Verify it contains package.json with workspaces
      const packageJsonPath = path.join(workspaceRoot, 'package.json');

      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(packageJson.workspaces).toBeDefined();
    });

    it('should throw error when workspace root cannot be found', () => {
      const tempDir = '/tmp/nonexistent/path';

      expect(() => {
        findWorkspaceRoot(tempDir);
      }).toThrow(new Error('Could not find workspace root with package.json containing workspaces field'));
    });
  });

  describe('getServerPath', () => {
    it('should return correct server path', () => {
      const serverPath = getServerPath();

      expect(serverPath).toBeDefined();
      expect(typeof serverPath).toBe('string');
      expect(serverPath).toContain('packages/@webex/test-helper-server');
      expect(path.isAbsolute(serverPath)).toBe(true);
    });

    it('should return correct server path from custom start path', () => {
      const subdirectory = path.join(process.cwd(), 'packages', 'legacy');
      const serverPath = getServerPath(subdirectory);

      expect(serverPath).toBeDefined();
      expect(typeof serverPath).toBe('string');
      expect(serverPath).toContain('packages/@webex/test-helper-server');
      expect(path.isAbsolute(serverPath)).toBe(true);
    });

    it('should throw error when workspace root cannot be found', () => {
      const tempDir = '/tmp/nonexistent/path';

      expect(() => {
        getServerPath(tempDir);
      }).toThrow(new Error('Could not find workspace root with package.json containing workspaces field'));
    });
  });
});
