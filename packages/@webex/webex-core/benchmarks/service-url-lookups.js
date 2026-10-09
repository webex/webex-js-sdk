#!/usr/bin/env node

/* eslint-disable require-jsdoc -- This executable keeps its small helpers local. */
/* eslint-disable no-await-in-loop -- Benchmark operations and samples intentionally run serially. */
/* eslint-disable @typescript-eslint/no-var-requires -- The benchmark is a CommonJS CLI. */

const assert = require('node:assert/strict');
const {execFileSync, spawnSync} = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const {performance} = require('node:perf_hooks');

const DEFAULT_CATALOG_SIZE = 3000;
const DEFAULT_ITERATIONS = 15;
const DEFAULT_OPERATIONS = 500;
const DEFAULT_SEED = 5230;
const URLS_PER_SERVICE = 2;
const SERVICES_PER_GATEWAY = 50;
const PHASES = ['ingestion', 'lookup', 'combined'];
const DEFAULT_SDK_ROOT = path.resolve(__dirname, '../../../..');

function parseArguments(argv) {
  const argumentsByName = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const name = argument.slice(2);
    const nextArgument = argv[index + 1];

    if (nextArgument && !nextArgument.startsWith('--')) {
      argumentsByName[name] = nextArgument;
      index += 1;
    } else {
      argumentsByName[name] = true;
    }
  }

  return argumentsByName;
}

function readPositiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }

  return number;
}

function percentile(sortedValues, fraction) {
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * fraction) - 1);

  return sortedValues[Math.max(0, index)];
}

function summarize(samples) {
  const sorted = [...samples].sort((left, right) => left - right);

  return {
    minMs: sorted[0],
    medianMs: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted[sorted.length - 1],
  };
}

function makeRandom(seed) {
  let state = seed % 2147483647;

  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;

    return (state - 1) / 2147483646;
  };
}

function shuffle(values, seed) {
  const result = [...values];
  const random = makeRandom(seed);

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));

    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function makeUrlDescriptor(index) {
  const gatewayIndex = Math.floor(index / SERVICES_PER_GATEWAY);
  const pathName = `/service-${index}/api/v1`;

  return {
    direct: `https://service-${index}.example.com${pathName}`,
    directHost: `service-${index}.example.com`,
    gateway: `https://gateway-${gatewayIndex}.example.com${pathName}`,
    gatewayHost: `gateway-${gatewayIndex}.example.com`,
    name: `service-${index}`,
    id: `cluster-${index}`,
  };
}

function makeCounters() {
  return {
    catalogIngestionCalls: 0,
    waitForServiceCalls: 0,
    getServiceFromUrlCalls: 0,
    catalogLookupCalls: 0,
    catalogBaseUrlReads: 0,
    alternateHostReads: 0,
    urlConstructorAttempts: 0,
    urlConstructorFailures: 0,
  };
}

function resetCounters(counters) {
  Object.keys(counters).forEach((counterName) => {
    counters[counterName] = 0;
  });
}

function countedObject(target, counters, propertyCounters) {
  return new Proxy(target, {
    get(object, property, receiver) {
      const counterName = Object.hasOwn(propertyCounters, property)
        ? propertyCounters[property]
        : undefined;

      if (counterName) {
        counters[counterName] += 1;
      }

      return Reflect.get(object, property, receiver);
    },
  });
}

function makeCatalogInput({implementation, descriptors, counters, instrumented}) {
  if (implementation === 'v2') {
    return descriptors.map((descriptor) => {
      const serviceUrls = [
        {
          baseUrl: descriptor.direct,
          host: descriptor.directHost,
          priority: 1,
          failed: false,
        },
        {
          baseUrl: descriptor.gateway,
          host: descriptor.gatewayHost,
          priority: 2,
          failed: false,
        },
      ];

      return {
        id: descriptor.id,
        serviceName: descriptor.name,
        serviceUrls: instrumented
          ? serviceUrls.map((serviceUrl) =>
              countedObject(serviceUrl, counters, {baseUrl: 'catalogBaseUrlReads'})
            )
          : serviceUrls,
      };
    });
  }

  return descriptors.map((descriptor) => {
    const alternateHost = {
      host: descriptor.gatewayHost,
      priority: 2,
      homeCluster: false,
      failed: false,
    };
    const serviceUrl = {
      name: descriptor.name,
      defaultUrl: descriptor.direct,
      hosts: [
        instrumented
          ? countedObject(alternateHost, counters, {host: 'alternateHostReads'})
          : alternateHost,
      ],
    };

    return instrumented
      ? countedObject(serviceUrl, counters, {defaultUrl: 'catalogBaseUrlReads'})
      : serviceUrl;
  });
}

function buildFixture({sdkRoot, implementation, instrumented, catalogSize}) {
  const corePath = path.join(sdkRoot, 'packages/@webex/webex-core/dist');
  const mockWebexPath = path.join(sdkRoot, 'node_modules/@webex/test-helper-mock-webex');
  // These paths intentionally target the trusted checkout selected by --sdk-root.
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const core = require(corePath);
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const MockWebex = require(mockWebexPath);
  const counters = makeCounters();
  const serviceCount = catalogSize / URLS_PER_SERVICE;
  const descriptors = Array.from({length: serviceCount}, (_, index) => makeUrlDescriptor(index));
  const ServicesClass = implementation === 'v2' ? core.ServicesV2 : core.Services;
  const webex = new MockWebex({children: {services: ServicesClass}});

  webex.config.services = {servicesNotNeedValidation: []};

  const {services} = webex.internal;
  const catalog = services._getCatalog();
  const catalogInput = makeCatalogInput({implementation, descriptors, counters, instrumented});

  return {services, catalog, catalogInput, descriptors, counters, implementation};
}

function ingestCatalog(fixture) {
  const {catalog, catalogInput, counters, descriptors, implementation, services} = fixture;

  counters.catalogIngestionCalls += 1;

  if (implementation === 'v2') {
    catalog.updateServiceGroups('postauth', catalogInput);
    services._activeServices = Object.fromEntries(
      descriptors.map((descriptor) => [descriptor.name, descriptor.id])
    );
  } else {
    catalog.updateServiceUrls('postauth', catalogInput);
  }

  catalog.isReady = true;
}

function instrumentStoredCatalog(fixture) {
  const {catalog, counters, implementation} = fixture;

  if (implementation === 'v2') {
    catalog.serviceGroups.postauth.forEach((serviceDetail) => {
      serviceDetail.serviceUrls = serviceDetail.serviceUrls.map((serviceUrl) =>
        countedObject(serviceUrl, counters, {baseUrl: 'catalogBaseUrlReads'})
      );
    });

    return;
  }

  catalog.serviceGroups.postauth = catalog.serviceGroups.postauth.map((serviceUrl) => {
    serviceUrl.hosts = serviceUrl.hosts.map((host) =>
      countedObject(host, counters, {host: 'alternateHostReads'})
    );

    return countedObject(serviceUrl, counters, {defaultUrl: 'catalogBaseUrlReads'});
  });
}

function wrapMethod(target, methodName, counters, counterName) {
  const originalMethod = target[methodName];

  if (typeof originalMethod !== 'function') {
    return () => undefined;
  }

  target[methodName] = function wrappedMethod(...args) {
    counters[counterName] += 1;

    return originalMethod.apply(this, args);
  };

  return () => {
    target[methodName] = originalMethod;
  };
}

function installDiagnostics(fixture) {
  const {services, catalog, counters, implementation} = fixture;
  let catalogMethod = 'findServiceUrlFromUrl';

  if (implementation === 'v2') {
    catalogMethod =
      typeof catalog.findServiceMatchFromUrl === 'function'
        ? 'findServiceMatchFromUrl'
        : 'findServiceDetailFromUrl';
  }

  const NativeURL = global.URL;
  const restoreMethods = [
    wrapMethod(services, 'waitForService', counters, 'waitForServiceCalls'),
    wrapMethod(services, 'getServiceFromUrl', counters, 'getServiceFromUrlCalls'),
    wrapMethod(catalog, catalogMethod, counters, 'catalogLookupCalls'),
  ];

  global.URL = new Proxy(NativeURL, {
    construct(Target, argumentsList, newTarget) {
      counters.urlConstructorAttempts += 1;

      try {
        return Reflect.construct(Target, argumentsList, newTarget);
      } catch (error) {
        counters.urlConstructorFailures += 1;
        throw error;
      }
    },
  });

  return () => {
    global.URL = NativeURL;
    restoreMethods.forEach((restore) => restore());
  };
}

function assertLookupResult(result, descriptor, matchedBaseUrl, implementation) {
  assert.ok(result, `Expected ${descriptor.name} to resolve`);
  assert.equal(result.name, descriptor.name);
  assert.equal(result.defaultUrl, implementation === 'v2' ? matchedBaseUrl : descriptor.direct);
  assert.equal(typeof result.priorityUrl, 'string');
}

function createBalancedOperations(descriptors, operationCount, seed) {
  const operations = [];
  const operationsPerCategory = operationCount / 5;
  const lastIndex = descriptors.length - 1;
  const middleIndex = Math.floor(descriptors.length / 2);
  const lookupGroups = [
    {descriptor: descriptors[0], baseUrl: descriptors[0].direct},
    {descriptor: descriptors[middleIndex], baseUrl: descriptors[middleIndex].direct},
    {descriptor: descriptors[lastIndex], baseUrl: descriptors[lastIndex].direct},
    {descriptor: descriptors[lastIndex], baseUrl: descriptors[lastIndex].gateway},
  ];

  for (let index = 0; index < operationsPerCategory; index += 1) {
    operations.push({kind: 'name', descriptor: descriptors[lastIndex]});
  }

  lookupGroups.forEach(({descriptor, baseUrl}, groupIndex) => {
    for (let index = 0; index < operationsPerCategory; index += 1) {
      operations.push({
        kind: 'url',
        descriptor,
        baseUrl,
        candidate: `${baseUrl}/resource-${groupIndex}-${index}?request=${index}`,
      });
    }
  });

  return shuffle(operations, seed);
}

async function runBalancedOperations(fixture, operations) {
  const {services, implementation} = fixture;
  let checksum = 0;

  for (const operation of operations) {
    if (operation.kind === 'name') {
      const result = await services.waitForService({name: operation.descriptor.name});

      assert.equal(result, operation.descriptor.direct);
    } else {
      const result = services.getServiceFromUrl(operation.candidate);

      assertLookupResult(result, operation.descriptor, operation.baseUrl, implementation);
    }

    checksum += 1;
  }

  return checksum;
}

async function runWorker(args) {
  const sdkRoot = path.resolve(args['sdk-root'] || DEFAULT_SDK_ROOT);
  const {implementation, phase, mode} = args;
  const catalogSize = readPositiveInteger(
    args['catalog-size'],
    DEFAULT_CATALOG_SIZE,
    'catalog-size'
  );
  const operationCount = readPositiveInteger(args.operations, DEFAULT_OPERATIONS, 'operations');
  const seed = readPositiveInteger(args.seed, DEFAULT_SEED, 'seed');

  if (!['legacy', 'v2'].includes(implementation)) {
    throw new Error('--implementation must be legacy or v2 in worker mode');
  }

  if (!PHASES.includes(phase)) {
    throw new Error(`--phase must be one of: ${PHASES.join(', ')}`);
  }

  if (!['diagnostic', 'timing'].includes(mode)) {
    throw new Error('--mode must be diagnostic or timing in worker mode');
  }

  if (catalogSize % URLS_PER_SERVICE !== 0) {
    throw new Error(`--catalog-size must be divisible by ${URLS_PER_SERVICE}`);
  }

  if (operationCount % 5 !== 0) {
    throw new Error('--operations must be divisible by 5');
  }

  const instrumented = mode === 'diagnostic';
  const fixture = buildFixture({sdkRoot, implementation, instrumented, catalogSize});
  const operations = createBalancedOperations(fixture.descriptors, operationCount, seed);
  let uninstallDiagnostics = () => undefined;

  if (phase === 'lookup') {
    ingestCatalog(fixture);

    // Warm both the engine and #5230's lazy catalog-URL cache before measuring steady-state lookup.
    if (mode === 'timing') {
      for (let index = 0; index < 3; index += 1) {
        await runBalancedOperations(fixture, operations);
      }
    }

    if (instrumented) {
      resetCounters(fixture.counters);
      instrumentStoredCatalog(fixture);
      uninstallDiagnostics = installDiagnostics(fixture);
    }
  } else if (instrumented) {
    uninstallDiagnostics = installDiagnostics(fixture);
  }

  const start = performance.now();
  let checksum = 0;
  let elapsedMs;

  try {
    if (phase === 'ingestion' || phase === 'combined') {
      ingestCatalog(fixture);
    }

    if (phase === 'lookup' || phase === 'combined') {
      if (phase === 'combined' && instrumented) {
        instrumentStoredCatalog(fixture);
      }

      checksum = await runBalancedOperations(fixture, operations);
    }
  } finally {
    elapsedMs = performance.now() - start;
    uninstallDiagnostics();
  }

  return {
    implementation,
    phase,
    mode,
    catalogSize,
    operationCount: phase === 'ingestion' ? 0 : operationCount,
    elapsedMs,
    checksum,
    ...(instrumented ? {counters: fixture.counters} : {}),
  };
}

function runChild(argumentsList) {
  const child = spawnSync(process.execPath, [__filename, '--worker', ...argumentsList], {
    encoding: 'utf8',
  });

  if (child.status !== 0) {
    throw new Error(child.stderr || child.stdout || 'Benchmark worker failed');
  }

  return JSON.parse(child.stdout);
}

function makeWorkerArguments(options, implementation, phase, mode) {
  return [
    '--sdk-root',
    options.sdkRoot,
    '--implementation',
    implementation,
    '--phase',
    phase,
    '--mode',
    mode,
    '--catalog-size',
    String(options.catalogSize),
    '--operations',
    String(options.operationCount),
    '--seed',
    String(options.seed),
  ];
}

function runCase(options, implementation, phase) {
  const diagnostic = runChild(makeWorkerArguments(options, implementation, phase, 'diagnostic'));
  const samples = [];
  let lastTiming;

  // Each sample uses a fresh process. Process startup and module loading happen before the timer.
  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    lastTiming = runChild(makeWorkerArguments(options, implementation, phase, 'timing'));
    samples.push(lastTiming.elapsedMs);
  }

  const duration = summarize(samples);

  return {
    implementation,
    phase,
    catalogSize: lastTiming.catalogSize,
    operationCount: lastTiming.operationCount,
    diagnostic: diagnostic.counters,
    duration: {
      ...duration,
      medianPerOperationMs:
        lastTiming.operationCount > 0 ? duration.medianMs / lastTiming.operationCount : undefined,
      p95PerOperationMs:
        lastTiming.operationCount > 0 ? duration.p95Ms / lastTiming.operationCount : undefined,
      samples: options.iterations,
    },
  };
}

function getCommit(sdkRoot) {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: sdkRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function printHelp() {
  process.stdout.write('Service URL lookup benchmark\n\n');
  process.stdout.write('Usage:\n');
  process.stdout.write(
    '  yarn workspace @webex/webex-core benchmark:service-url-lookups [options]\n\n'
  );
  process.stdout.write('Options:\n');
  process.stdout.write('  --implementation legacy|v2|both  Default: both\n');
  process.stdout.write('  --phase ingestion|lookup|combined|all  Default: all\n');
  process.stdout.write('  --catalog-size <number>            Default: 3000 URLs\n');
  process.stdout.write(
    '  --operations <number>              Default: 500; must be divisible by 5\n'
  );
  process.stdout.write('  --iterations <number>              Default: 15\n');
  process.stdout.write('  --seed <number>                    Default: 5230\n');
  process.stdout.write('  --sdk-root <trusted-checkout>      Default: current checkout\n');
  process.stdout.write('  --json                             Emit machine-readable JSON\n');
  process.stdout.write('  --help                             Show this help\n');
}

function formatMilliseconds(value) {
  return `${value.toFixed(3)} ms`;
}

function printHumanResult(report) {
  process.stdout.write('Service URL lookup benchmark\n');
  process.stdout.write(
    `commit=${report.environment.commit} node=${report.environment.node} ` +
      `platform=${report.environment.platform} cpu=${report.environment.cpu}\n`
  );
  process.stdout.write(
    `catalog=${report.options.catalogSize} URLs operations=${report.options.operationCount} ` +
      `seed=${report.options.seed} iterations=${report.options.iterations}\n`
  );

  report.results.forEach((result) => {
    const perOperation =
      result.duration.medianPerOperationMs === undefined
        ? ''
        : ` per-op=${formatMilliseconds(result.duration.medianPerOperationMs)}`;

    process.stdout.write(`\n${result.implementation} / ${result.phase}\n`);
    process.stdout.write(`  diagnostic ${JSON.stringify(result.diagnostic)}\n`);
    process.stdout.write(
      `  duration median=${formatMilliseconds(result.duration.medianMs)} ` +
        `p95=${formatMilliseconds(result.duration.p95Ms)}${perOperation}\n`
    );
  });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));

  if (args.help) {
    printHelp();

    return;
  }

  if (args.worker) {
    const result = await runWorker(args);

    process.stdout.write(`${JSON.stringify(result)}\n`);

    return;
  }

  const implementation = args.implementation || 'both';
  const phase = args.phase || 'all';
  const catalogSize = readPositiveInteger(
    args['catalog-size'],
    DEFAULT_CATALOG_SIZE,
    'catalog-size'
  );
  const operationCount = readPositiveInteger(args.operations, DEFAULT_OPERATIONS, 'operations');
  const iterations = readPositiveInteger(args.iterations, DEFAULT_ITERATIONS, 'iterations');
  const seed = readPositiveInteger(args.seed, DEFAULT_SEED, 'seed');
  const sdkRoot = path.resolve(args['sdk-root'] || DEFAULT_SDK_ROOT);

  if (!['legacy', 'v2', 'both'].includes(implementation)) {
    throw new Error('--implementation must be legacy, v2, or both');
  }

  if (phase !== 'all' && !PHASES.includes(phase)) {
    throw new Error(`--phase must be one of: all, ${PHASES.join(', ')}`);
  }

  if (catalogSize % URLS_PER_SERVICE !== 0) {
    throw new Error(`--catalog-size must be divisible by ${URLS_PER_SERVICE}`);
  }

  if (operationCount % 5 !== 0) {
    throw new Error('--operations must be divisible by 5');
  }

  const options = {sdkRoot, catalogSize, operationCount, iterations, seed};
  const implementations = implementation === 'both' ? ['legacy', 'v2'] : [implementation];
  const phases = phase === 'all' ? PHASES : [phase];
  const cpu = os.cpus()[0];
  const report = {
    environment: {
      commit: getCommit(sdkRoot),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpu ? cpu.model : 'unknown',
    },
    options: {catalogSize, operationCount, iterations, seed},
    results: [],
  };

  implementations.forEach((implementationName) => {
    phases.forEach((phaseName) => {
      report.results.push(runCase(options, implementationName, phaseName));
    });
  });

  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printHumanResult(report);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
