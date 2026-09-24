const fs = require('fs');
const os = require('os');
const path = require('path');

const kmsCaroots = require('@webex/kms-caroots');
const { KmsCaroots } = require('@webex/legacy-tools');

describe('KmsCaroots', () => {
  let packageRoot;

  beforeEach(() => {
    packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-tools-kms-'));
  });

  afterEach(() => {
    fs.rmSync(packageRoot, { force: true, recursive: true });
  });

  it('should write generated CA roots to the bootstrap file', async () => {
    const caroots = ['root-a', 'root-b'];
    spyOn(kmsCaroots, 'generateKmsCaroots').and.resolveTo(caroots);

    const result = await KmsCaroots.prepareTestBootstrap(packageRoot);

    expect(result.file).toBe(path.join(packageRoot, '.kms-caroots.bootstrap.js'));
    expect(fs.readFileSync(result.file, 'utf8')).toContain(
      `config.encryption.caroots = ${JSON.stringify(caroots)};`,
    );

    result.cleanup();

    expect(fs.existsSync(result.file)).toBeFalse();
  });

  it('should disable KMS certificate validation when generation fails', async () => {
    spyOn(kmsCaroots, 'generateKmsCaroots').and.rejectWith(new Error('generation failed'));

    const result = await KmsCaroots.prepareTestBootstrap(packageRoot);

    expect(fs.readFileSync(result.file, 'utf8')).toContain(
      'config.encryption.shouldValidateKMSCertificate = false;',
    );

    result.cleanup();
    result.cleanup();

    expect(fs.existsSync(result.file)).toBeFalse();
  });
});
