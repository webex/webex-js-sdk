/* eslint jest/expect-expect: ["warn", {"assertFunctionNames": ["assert.*"]}] */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { assert } = require('@webex/test-helper-chai');

const { default: getReleaseRef } = require('../../../dist/module/utils/yarn/yarn.changes');

describe('release change selection', () => {
  let directory;
  let previousDirectory;
  let base;

  const git = (...args) => execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  const write = (file, contents = 'changed\n') => {
    const target = path.join(directory, file);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  };

  const commit = () => {
    git('add', '.');
    git('commit', '-qm', 'Fixture changes');
  };

  beforeEach(() => {
    previousDirectory = process.cwd();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'webex-release-changes-'));
    git('init', '-q');
    git('config', 'user.name', 'Release test');
    git('config', 'user.email', 'release-test@example.invalid');
    write('.gitignore', 'ignored/\n');
    write('README.md', '# Project\n');
    write('packages/example/src/index.js', 'module.exports = 1;\n');
    write('packages/example/README.md', '# Example\n');
    write('packages/example/package.json', '{"name":"@fixture/example"}\n');
    write('packages/other/package.json', '{"name":"@fixture/other"}\n');
    commit();
    base = git('rev-parse', 'HEAD');
    process.chdir(directory);
  });

  afterEach(() => {
    process.chdir(previousDirectory);
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    'README.md',
    'guide.mdx',
    'packages/example/README.md',
    'packages/example/src/ai-docs/design.json',
    'packages/example/docs/diagram.svg',
    'packages/example/.sdd/manifest.json',
    '.sdd/templates/task.yml',
    '.repo-context.json',
    'packages/example/.repo-context.json',
    'packages/example/schemas/repo-context.schema.json',
    'documentation/config.yml',
    'docs/samples/example.js',
    'packages/example/.sdd/.gitignore',
  ])('should omit documentation-only changes to %s', async (file) => {
    write(file);
    commit();

    assert.isUndefined(await getReleaseRef(base));
  });

  it.each([
    'packages/example/src/index.js',
    'packages/example/package.json',
    'packages/example/.gitignore',
    'packages/example/.npmignore',
    '.gitignore',
    'yarn.lock',
    'packages/example/assets/icon.svg',
    'packages/example/schemas/runtime.schema.json',
    'packages/example/test/unit.js',
    'config/webpack.js',
    'packages/example/src/file with spaces.js',
    'packages/example/src/$(touch injected).js',
  ])('should retain release-affecting changes to %s', async (file) => {
    write(file);
    commit();

    assert.strictEqual(await getReleaseRef(base), base);
    assert.isFalse(fs.existsSync(path.join(directory, 'injected')));
  });

  it.each([
    ['packages/example/src/index.js', 'packages/example/docs/index.js', true],
    ['packages/example/README.md', 'packages/example/src/guide.js', true],
    ['packages/example/README.md', 'packages/example/guide.md', false],
    ['packages/example/src/index.js', 'packages/example/src/renamed.js', true],
  ])('should classify a move from %s to %s', async (from, to, shouldRelease) => {
    fs.mkdirSync(path.dirname(path.join(directory, to)), { recursive: true });
    git('mv', from, to);
    commit();

    const reference = await getReleaseRef(base);

    assert.strictEqual(reference, shouldRelease ? base : undefined);
  });

  it.each([
    ['packages/example/src/index.js', true],
    ['packages/example/README.md', false],
  ])('should classify deletion of %s', async (file, shouldRelease) => {
    git('rm', file);
    commit();

    assert.strictEqual(await getReleaseRef(base), shouldRelease ? base : undefined);
  });

  it.each([
    ['packages/example/src/untracked.js', true],
    ['packages/example/src/ai-docs/untracked.json', false],
    ['ignored/untracked.js', false],
  ])('should classify untracked changes to %s', async (file, shouldRelease) => {
    write(file);

    assert.strictEqual(await getReleaseRef(base), shouldRelease ? base : undefined);
    assert.isUndefined(await getReleaseRef(base, true));
  });

  it.each([false, true])('should retain %s staged source changes', async (staged) => {
    write('packages/example/src/index.js');

    if (staged) {
      git('add', '.');
    }

    assert.strictEqual(await getReleaseRef(base), base);
    assert.isUndefined(await getReleaseRef(base, true));
  });

  it.each([false, true])('should omit docs-only commits with a %s staged manifest rewrite', async (staged) => {
    const file = 'packages/example/package.json';
    const manifest = {
      name: '@fixture/example',
      browser: { './b.js': './b.browser.js', './a.js': './a.browser.js' },
    };

    write(file, JSON.stringify(manifest));
    commit();
    const reference = git('rev-parse', 'HEAD');

    write('packages/example/README.md');
    commit();
    write(file, JSON.stringify({
      ...manifest,
      browser: { './a.js': './a.browser.js', './b.js': './b.browser.js' },
    }));

    if (staged) {
      git('add', file);
    }

    assert.strictEqual(await getReleaseRef(reference), reference);
    assert.isUndefined(await getReleaseRef(reference, true));
  });

  it('should retain committed code when a local edit restores the old contents', async () => {
    write('packages/example/src/index.js', 'module.exports = 2;\n');
    commit();
    write('packages/example/src/index.js', 'module.exports = 1;\n');

    assert.strictEqual(await getReleaseRef(base, true), base);
  });

  it('should return no comparison commit for an empty change set', async () => {
    assert.isUndefined(await getReleaseRef(base));
  });

  it.each([false, true])('should retain code before the last docs commit with committed=%s', async (committed) => {
    write('packages/example/src/index.js');
    commit();
    write('README.md');
    commit();

    assert.strictEqual(await getReleaseRef(base, committed), base);
  });

  it.each([false, true])('should retain mixed docs and code with committed=%s', async (committed) => {
    write('packages/example/docs/diagram.svg');
    write('packages/example/src/index.js');
    commit();

    assert.strictEqual(await getReleaseRef(base, committed), base);
  });

  it('should check all packages when invoked from a workspace directory', async () => {
    write('packages/example/src/index.js');
    commit();
    process.chdir(path.join(directory, 'packages/other'));

    assert.strictEqual(await getReleaseRef(base), base);
  });

  it('should compare with the merge base when the reference is on another branch', async () => {
    write('packages/example/src/index.js', 'module.exports = 2;\n');
    commit();
    const comparison = git('rev-parse', 'HEAD');

    git('checkout', '--detach', '-q', base);
    write('packages/example/src/index.js', 'module.exports = 2;\n');
    write('README.md');
    commit();

    assert.strictEqual(await getReleaseRef(comparison), base);
  });

  it('should treat reference names as data', async () => {
    const reference = ['reference;touch', '{IFS}injected'].join('$');

    git('branch', reference, base);
    write('packages/example/src/index.js');
    commit();

    assert.strictEqual(await getReleaseRef(reference), base);
    assert.isFalse(fs.existsSync(path.join(directory, 'injected')));
  });

  it('should reject an invalid comparison reference', async () => {
    await assert.isRejected(getReleaseRef('missing-reference'));
  });

  it('should find code changes alongside a large documentation change set', async () => {
    Array.from({ length: 3100 }, (_, index) => write(`docs/page-${index}.md`));
    write('packages/example/src/index.js');
    commit();

    assert.strictEqual(await getReleaseRef(base), base);
  });
});
