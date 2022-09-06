import {assert} from '@webex/test-helper-chai';

import validateCert, {KMSError} from '../../../src/kms-certificate-validation';

const caroots = ['MIID6TCCAtGgAwIBAgIURmBu688C9oUIJXlykr1J3fi5H4kwDQYJKoZIhvcNAQELBQAwgYMxCzAJBgNVBAYTAlVTMREwDwYDVQQIDAhDb2xvcmFkbzEPMA0GA1UEBwwGRGVudmVyMRAwDgYDVQQKDAdFeGFtcGxlMR8wHQYDVQQDDBZodHRwczovL2NhLmV4YW1wbGUuY29tMR0wGwYJKoZIhvcNAQkBFg5jYUBleGFtcGxlLmNvbTAeFw0yMDAyMDYyMDIyMDhaFw00MDAyMDEyMDIyMDhaMIGDMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEfMB0GA1UEAwwWaHR0cHM6Ly9jYS5leGFtcGxlLmNvbTEdMBsGCSqGSIb3DQEJARYOY2FAZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7TaDWldwjU65y4fnNDIuNu4dZi3bZvaN9nJ3A8D9pwFcNx3DL5cPpafAkJuE/2ZBrsZxJWKwXLQFuNE9V3XVslv0OPgEZVfY5AKuPhVezRqEqsCdUgODMkJat6PE02r0NZRFpBiRCThh0wY5u/tiTiPgjHwEPhBEyLgcJ6FOWLn9wBsS4SvBzfppYGL5GW1G0eN9yORnKKgqkgyf0x8FvTMyVSjtkhcI/kA/8061sl4DFG6sefQmAOVvH7tp7YmN+jpQ7cOKQtjOpZS6Gp22u7LEI0/qb5n2QvjjcUQM81mN6CZ8nciWXRgjBhdAJJhmyMvcx8rnVb6vtU26fCaetAgMBAAGjUzBRMB0GA1UdDgQWBBRZiCyKaTYL94gwhxzktYg32qMOYjAfBgNVHSMEGDAWgBRZiCyKaTYL94gwhxzktYg32qMOYjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQATa2QkTGcj8IPjItnvg23ihlRjHdFHn6lB7uYPhcDurwRlBrlC2/OB44P3dHB9tEPbV4unoF9ftEKO3nNY3HUDcPrQwRqkPftlYYr4/6z/jnmNBRgiDICVaiTZNlX54fLiPsSAbIymPWLLLNtq17vjVEcfGUXhi/F+EkN/uXZ4yH6RK0YjBRwPV9cfziz1YsF2WVYVYtQErf+NTjnYR5S4Ba2kEqhI5j7mNhiafPNODaOchHcaRMvfWcBhlHt+atwNyPxNr4NP+cDjAWg0I8xAUdbZGQiRJecjkctolLHsfZXj+ulEv3eaKw7gSo3Aekexw8aZS7soy+VM1fzmLopw'];

const x5c = ['MIIDaDCCAlACFG2NkKF2WKCN/OnGN2E7mBamxhB2MA0GCSqGSIb3DQEBCwUAMIGDMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEfMB0GA1UEAwwWaHR0cHM6Ly9jYS5leGFtcGxlLmNvbTEdMBsGCSqGSIb3DQEJARYOY2FAZXhhbXBsZS5jb20wHhcNMjAwMjA2MjAzMjU0WhcNNDAwMjAxMjAzMjU0WjBdMQswCQYDVQQGEwJVUzERMA8GA1UECAwIQ29sb3JhZG8xDzANBgNVBAcMBkRlbnZlcjEQMA4GA1UECgwHRXhhbXBsZTEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2OObWUoNG0Wv4zYuhGUT7JNiUkefUsFZ384NS2l5VOB/lSNcElBtmX55yPcjvPnukfpETDUG82K8ncOwCuV8ZTpvzM3QHSIHGyO5JBFJ38U6Pq6kHje6An+eSHLCVkQfOlf4TCRb8SlcEoi8wkl3IIGewzC0/87b1OvyYTb8BHZJVeUV7AxcZChkAA/IJV5ADnmc/6ZCihXVuCWJgTFpLLv7HVqE924lNDTgRn64ioCpHK4pC1FFqQKLlsq0tV75gc5d7A6m5/9znEvg02JuqUFd9LdOcnf8QeTkyg6OTTvJUUa39KZDKONi8MXiECacGU6VbUvuKOXZU49UeqVKQQIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCmlEodmn5LfgIWViRn8t4qjTZoM7VUGWXfCnaMqSnW6P0eYbZdCoCecja6WicBWPAlFFR/UscYv4rEGXtmzD+GQUQKfYFfsNdkfCpPvCFlpudHNuW0kCZ8lUfDWQRirrC+MyiAVpEG7mNHNZfK9hof05MHS6ItcpET5+F0DiC6l+vsBBRqP2SU8bo9gTrr8WO7bW8JQb59XNEoTQC1AzCn172+idJcgaasOfp/V+QqODIa96YNM7vT9pj09nGL0Wxulaq546pW32HYkOhZw1nr8prZn17UFLfoQnaNuTuT2ZCsFc7V2H0UqcMwjg1QZoObLI5tXPv0syP6WXo19OjW'];
const x5cModulus = '2OObWUoNG0Wv4zYuhGUT7JNiUkefUsFZ384NS2l5VOB_lSNcElBtmX55yPcjvPnukfpETDUG82K8ncOwCuV8ZTpvzM3QHSIHGyO5JBFJ38U6Pq6kHje6An-eSHLCVkQfOlf4TCRb8SlcEoi8wkl3IIGewzC0_87b1OvyYTb8BHZJVeUV7AxcZChkAA_IJV5ADnmc_6ZCihXVuCWJgTFpLLv7HVqE924lNDTgRn64ioCpHK4pC1FFqQKLlsq0tV75gc5d7A6m5_9znEvg02JuqUFd9LdOcnf8QeTkyg6OTTvJUUa39KZDKONi8MXiECacGU6VbUvuKOXZU49UeqVKQQ';

const x5cSAN = ['MIIEHDCCAwSgAwIBAgIUbY2QoXZYoI386cY3YTuYFqbGEHcwDQYJKoZIhvcNAQELBQAwgYMxCzAJBgNVBAYTAlVTMREwDwYDVQQIDAhDb2xvcmFkbzEPMA0GA1UEBwwGRGVudmVyMRAwDgYDVQQKDAdFeGFtcGxlMR8wHQYDVQQDDBZodHRwczovL2NhLmV4YW1wbGUuY29tMR0wGwYJKoZIhvcNAQkBFg5jYUBleGFtcGxlLmNvbTAeFw0yMDAyMTExOTI5MDFaFw00MDAyMDYxOTI5MDFaMIGcMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ08xDzANBgNVBAcMBkRlbnZlcjEhMB8GA1UECgwYSW50ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMRYwFAYDVQQLDA1FeGFtcGxlLCBJbmMuMRQwEgYDVQQDDAtleGFtcGxlLmNvbTEeMBwGCSqGSIb3DQEJARYPa21zQGV4YW1wbGUuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4DzUlN27XQ+clCPhU3q4U6cZfzgYX1yGr5fdSzK5MzU5fxYooyudJ1L1Zc6/VaxVpjl4GvU9Y5DtKbaSNeFUaBDGae9GAcBWjcrTAVY3ftW4t1LnE6DJLvn3UmPNqEEhQMWVeyNftqjgS3c0ciQIYq3sUqcZvjglRBA61gLlsmFlfs23jgRTZZzGeDjxETjAeQgH+E/mIsnEj3Iit6iBsuhPf/DjlGzD5/LyEaQJK+OQj/7+xL5jAlk6M6Uo/7YOx7abVnnwWoAaYAX9vQS6trJQm2m4mzNFAEBTjdtJu/eNP5H4yfX1VaXgYKy1MaBhu9VkVMeMREVOp9DPWHFaVwIDAQABo20wazAfBgNVHSMEGDAWgBRZiCyKaTYL94gwhxzktYg32qMOYjAJBgNVHRMEAjAAMAsGA1UdDwQEAwIE8DAwBgNVHREEKTAnghRrbXMtdGVzdC5leGFtcGxlLmNvbYIPa21zLmV4YW1wbGUuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQCebaIWYk1mVtAndJpM/FTW0U3luYpUoOEIPRnrpcaBALG5ZwEwzaWKS42avRpjgCCiZGowSjdI8HgeUjO89g6OXgJduZNHVHKJnzV/8O76HTAaNIthHDQmqyywngvxnImf9txyXK+ZMdpgIWm351kaqHsLyN3GjknyVW/Xne5C4ONm7+y7jw6AdPRX0AoeEOGICAgrgni9k7kjLOskjyoCiJzjw+FxpVmsVAtjg1B2zXP8ce850B/ebJS4rkUr6082B+7DreDsSur4tTM5SFuoiLRrrnrpwKZ4CV3spaeO8zTn9b/3mousCWgL2KgEmBVjWSEYAT9RuB6pb1EIRYtY'];
const x5cSANModulus = '4DzUlN27XQ-clCPhU3q4U6cZfzgYX1yGr5fdSzK5MzU5fxYooyudJ1L1Zc6_VaxVpjl4GvU9Y5DtKbaSNeFUaBDGae9GAcBWjcrTAVY3ftW4t1LnE6DJLvn3UmPNqEEhQMWVeyNftqjgS3c0ciQIYq3sUqcZvjglRBA61gLlsmFlfs23jgRTZZzGeDjxETjAeQgH-E_mIsnEj3Iit6iBsuhPf_DjlGzD5_LyEaQJK-OQj_7-xL5jAlk6M6Uo_7YOx7abVnnwWoAaYAX9vQS6trJQm2m4mzNFAEBTjdtJu_eNP5H4yfX1VaXgYKy1MaBhu9VkVMeMREVOp9DPWHFaVw';

const x5cSelfSigned = ['MIIFmTCCA4GgAwIBAgIUOxbqWoC/R0Lt2eWgqE3960xTLE4wDQYJKoZIhvcNAQELBQAwXDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNPMQ8wDQYDVQQHDAZEZW52ZXIxFTATBgNVBAoMDEV4YW1wbGUgSW5jLjEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMB4XDTIwMDIxMTIwMjk0NVoXDTQwMDIwNjIwMjk0NVowXDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNPMQ8wDQYDVQQHDAZEZW52ZXIxFTATBgNVBAoMDEV4YW1wbGUgSW5jLjEYMBYGA1UEAwwPa21zLmV4YW1wbGUuY29tMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAyRUvQFD9UboxW4xjOyo2Cu7RsAT0GDx66Brl3tEnxvCwnfSystwerbAZtGtrklDJWcqAWVbSNwxnPuGsxSUg4D8ziI4Biqc6rvoNO4YYzpHWYmS9aLMG8TOUzAZZORrnvuiu7VGleZKi+Yd08fXSjrUV4sldRiD+Y0IN80xa52B0053yFX4geCuFn0Ewo8NXhkCU6Pfwb9wVVuCmcu9mt3ubpWRa2H+h2ie3suAc4ADrb9Ng63stU3UrjUcYv5guo0gBOBrk7i0WL/2KJf2NmDJiTaaCxR0gEe0sHjio7PCXDNHS0eJj/2++Wq90fDbBFDP/LP0aBKJAvaTZNEKcX5Hr/Y32Bz1Szpi18/HSlEF6rIketLiAzgLfzRMktctWLGGubp6RarNWALBX5kJA43/Cernaf0sVRtCUqjKPRd8k8Bo3BXl5VwVn2b+nZO6EJQ6RslOfbumFPVhlyFv6I1tAOPmZOHjOpc4ogPyI7jMefXMMsSJOGgLb7JVPpbi0bjXmsW7I0sWcAdDzcASNUxxp1c0qXZu4nHI2VlPucA4LA5W4Z1qcNQsfQEN4gdPWBeSbDBv0FPxFcHZNqk87ywvLkurgASL+KxqB9FzIqhv7w0OYm1r7iClBJxsbItYeehEypv/PJpxBq1uxcd6pExY6kTP3x8YAqUgb3GoWlUsCAwEAAaNTMFEwHQYDVR0OBBYEFOJqvx/CUIV6mkiTURkyVYiugkqVMB8GA1UdIwQYMBaAFOJqvx/CUIV6mkiTURkyVYiugkqVMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggIBAHTov7zZOMt7zAfy9N8X6yOsakUqAXVtrTDu9DMn9kw2vhudSfNfno7dSc3JeE+KtySkyfrMbNub19IzfVHMI2dRiO7PGzgv8XD69PC/PKaqNmViW27P0l4ORGKE4RHcjd0Y0Rj8nciwHDu4u7p9gI1yS7TiLtpQqyb0ba/ZVP88EVe7wI+BtoHiSMQeEjs13gTSARTYXay0WsL7xxwzKH68Y4RRjfqt+NpyMP7wrf5Kcha2cID8jG9i4LqSoj+o5jvwH969jEP+9DX7XFx0894O42xGreyl1E1HkKOgrGE+owkEpVNYLfcQP3tbx3maoG2g5TXMtMqei1ffNdUiONPbi9II1UP53JrTcnFUb3aVo2yLJ5ftkOSWpkyhk9G9TWoUiTB/k3Jb6gxzk6HvjhLgYTeT+UPW/ATiffL7SNmGTQBuVuNUHNxm4sAz9oQTmCo+8vCqMtqK4IHeKqNP+yqVGCAI71yEcxuYy17S57iarK7ON/RTMiblerUOowOSBzTmm+7kuR8Ke0BVCw6l0A7yUueAUnRaVXEAszvhHsLxZMlnMeYlL5qj6CAamdgpwdsMFa0QcAAcGl6j3vW9ks9nLlEAzJmUIQUx33W4SryYwflliWkH4f4OlRj7Lrq81/QvZ+tTUTiTBrvZjB1j9ezCv0Fjp9cEDi1hyV1ArKV3'];
const x5cSelfSignedModulus = 'yRUvQFD9UboxW4xjOyo2Cu7RsAT0GDx66Brl3tEnxvCwnfSystwerbAZtGtrklDJWcqAWVbSNwxnPuGsxSUg4D8ziI4Biqc6rvoNO4YYzpHWYmS9aLMG8TOUzAZZORrnvuiu7VGleZKi-Yd08fXSjrUV4sldRiD-Y0IN80xa52B0053yFX4geCuFn0Ewo8NXhkCU6Pfwb9wVVuCmcu9mt3ubpWRa2H-h2ie3suAc4ADrb9Ng63stU3UrjUcYv5guo0gBOBrk7i0WL_2KJf2NmDJiTaaCxR0gEe0sHjio7PCXDNHS0eJj_2--Wq90fDbBFDP_LP0aBKJAvaTZNEKcX5Hr_Y32Bz1Szpi18_HSlEF6rIketLiAzgLfzRMktctWLGGubp6RarNWALBX5kJA43_Cernaf0sVRtCUqjKPRd8k8Bo3BXl5VwVn2b-nZO6EJQ6RslOfbumFPVhlyFv6I1tAOPmZOHjOpc4ogPyI7jMefXMMsSJOGgLb7JVPpbi0bjXmsW7I0sWcAdDzcASNUxxp1c0qXZu4nHI2VlPucA4LA5W4Z1qcNQsfQEN4gdPWBeSbDBv0FPxFcHZNqk87ywvLkurgASL-KxqB9FzIqhv7w0OYm1r7iClBJxsbItYeehEypv_PJpxBq1uxcd6pExY6kTP3x8YAqUgb3GoWlUs';

const VALID_JWT = {
  kty: 'RSA',
  kid: 'kms://kms.example.com',
  x5c,
  e: 'AQAB',
  n: x5cModulus
};

const VALID_JWT_SAN = {
  kty: 'RSA',
  kid: 'kms://kms.example.com',
  x5c: x5cSAN,
  n: x5cSANModulus,
  e: 'AQAB'
};

const validate = validateCert(caroots);

describe('internal-plugin-encryption', () => {
  describe('kms-certificate-validation', () => {
    it('validates a good JWT', () => validate(VALID_JWT)
      .then((jwt) => assert.equal(jwt, VALID_JWT)));

    it('validates a good JWT (SAN extension)', () => validate(VALID_JWT_SAN)
      .then((validJwt) => assert.equal(validJwt, VALID_JWT_SAN)));

    it('rejects if `JWT` is undefined',
      () => assert.isRejected(validate(), KMSError));

    it('rejects if the `kty` is wrong.', () => {
      const jwt = {
        ...VALID_JWT,
        kty: 'WRONG'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if `kty` is not a string', () => {
      const jwt = {
        ...VALID_JWT,
        kty: {}
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the `kid` is wrong', () => {
      const jwt = {
        ...VALID_JWT,
        kid: 'WRONG'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the `kid` is not a string', () => {
      const jwt = {
        ...VALID_JWT,
        kid: {a: 1}
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if there is not a list of certificates', () => {
      const jwt = {
        ...VALID_JWT,
        x5c: undefined
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if certificate list is not an array', () => {
      const jwt = {
        ...VALID_JWT,
        x5c: 'NOT AN ARRAY'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the certificate list is empty', () => {
      const jwt = {
        ...VALID_JWT,
        x5c: []
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the `kid` does not match the certificate', () => {
      const jwt = {
        ...VALID_JWT,
        kid: 'kms://not_correct.example.com'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the public exponent is wrong', () => {
      const jwt = {
        ...VALID_JWT,
        e: 'WRONG_VALUE'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects if the modulus is wrong', () => {
      const jwt = {
        ...VALID_JWT,
        n: 'WRONG_VALUE'
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('rejects a self signed certificate', () => {
      const jwt = {
        ...VALID_JWT,
        x5c: x5cSelfSigned,
        n: x5cSelfSignedModulus
      };

      return assert.isRejected(validate(jwt), KMSError);
    });

    it('accepts self signed certificate if no CA roots.', () => {
      const jwt = {
        ...VALID_JWT,
        x5c: x5cSelfSigned,
        n: x5cSelfSignedModulus
      };

      return validateCert()(jwt)
        .then((results) => assert.equal(results, jwt));
    });
  });
});
