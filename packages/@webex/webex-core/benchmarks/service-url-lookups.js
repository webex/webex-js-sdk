#!/usr/bin/env node

/* eslint-disable require-jsdoc -- This executable keeps its small helpers local. */
/* eslint-disable no-await-in-loop -- Benchmark samples must run serially. */
/* eslint-disable @typescript-eslint/no-var-requires -- The benchmark is a CommonJS CLI. */

const assert = require('node:assert/strict');
const {execFileSync, spawnSync} = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const {performance} = require('node:perf_hooks');

const DEFAULT_CATALOG_SIZE = 3000;
const DEFAULT_ITERATIONS = 15;
const DEFAULT_SEED = 5230;
const DEFAULT_TARGET_SAMPLE_MS = 100;
const URLS_PER_SERVICE = 2;
const SERVICES_PER_GATEWAY = 50;
const TRACE_OPERATIONS_PER_CATEGORY = 100;
const DEFAULT_SDK_ROOT = path.resolve(__dirname, '../../../..');
const SCENARIOS = [
  'name-hit',
  'invalid-url',
  'direct-early',
  'direct-middle',
  'direct-late',
  'gateway-late',
  'unknown-host',
  'known-host-wrong-path',
  'trace-hot',
  'trace-varied',
];

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
    gateway: `https://gateway-${gatewayIndex}.example.com${pathName}`,
    gatewayHost: `gateway-${gatewayIndex}.example.com`,
    name: `service-${index}`,
    id: `cluster-${index}`,
  };
}

function makeCounters() {
  return {
    waitForServiceCalls: 0,
    getServiceFromUrlCalls: 0,
    catalogLookupCalls: 0,
    catalogBaseUrlReads: 0,
    alternateHostReads: 0,
    urlConstructorAttempts: 0,
    urlConstructorFailures: 0,
  };
}

function countedObject(target, counters, propertyCounters) {
  return new Proxy(target, {
    get(object, property, receiver) {
      const counterName = propertyCounters[property];

      if (counterName) {
        counters[counterName] += 1;
      }

      return Reflect.get(object, property, receiver);
    },
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
  const isV2 = implementation === 'v2';
  const ServicesClass = isV2 ? core.ServicesV2 : core.Services;
  const webex = new MockWebex({children: {services: ServicesClass}});

  webex.config.services = {servicesNotNeedValidation: []};

  const {services} = webex.internal;
  const catalog = services._getCatalog();

  if (isV2) {
    const serviceDetails = descriptors.map((descriptor) => {
      const direct = {
        baseUrl: descriptor.direct,
        host: new URL(descriptor.direct).host,
        priority: 1,
        failed: false,
      };
      const gateway = {
        baseUrl: descriptor.gateway,
        host: descriptor.gatewayHost,
        priority: 2,
        failed: false,
      };
      const serviceUrls = instrumented
        ? [direct, gateway].map((serviceUrl) =>
            countedObject(serviceUrl, counters, {baseUrl: 'catalogBaseUrlReads'})
          )
        : [direct, gateway];

      return new core.ServiceDetail({
        id: descriptor.id,
        serviceName: descriptor.name,
        serviceUrls,
      });
    });

    catalog.serviceGroups.postauth = serviceDetails;
    services._activeServices = Object.fromEntries(
      descriptors.map((descriptor) => [descriptor.name, descriptor.id])
    );
  } else {
    const serviceUrls = descriptors.map((descriptor) => {
      const alternateHost = instrumented
        ? countedObject(
            {host: descriptor.gatewayHost, priority: 2, homeCluster: false, failed: false},
            counters,
            {host: 'alternateHostReads'}
          )
        : {host: descriptor.gatewayHost, priority: 2, homeCluster: false, failed: false};
      const serviceUrl = new core.ServiceUrl({
        name: descriptor.name,
        defaultHost: new URL(descriptor.direct).host,
        defaultUrl: descriptor.direct,
        hosts: [alternateHost],
      });

      return instrumented
        ? countedObject(serviceUrl, counters, {defaultUrl: 'catalogBaseUrlReads'})
        : serviceUrl;
    });

    catalog.serviceGroups.postauth = serviceUrls;
  }

  catalog.isReady = true;

  return {services, catalog, descriptors, counters, implementation};
}

function wrapMethod(target, methodName, counters, counterName) {
  const originalMethod = target[methodName];

  target[methodName] = function wrappedMethod(...args) {
    counters[counterName] += 1;

    return originalMethod.apply(this, args);
  };

  return () => {
    target[methodName] = originalMethod;
  };
}

function installDiagnostics(fixture, implementation) {
  const {services, catalog, counters} = fixture;
  const catalogMethod =
    implementation === 'v2' ? 'findServiceMatchFromUrl' : 'findServiceUrlFromUrl';
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

function assertLookupResult(result, descriptor, matchedBaseUrl) {
  assert.ok(result, `Expected ${descriptor.name} to resolve`);
  assert.equal(result.name, descriptor.name);
  assert.equal(result.defaultUrl, matchedBaseUrl);
  assert.equal(typeof result.priorityUrl, 'string');
}

function createTraceOperations(descriptors, varied, seed) {
  const operations = [];
  const lastIndex = descriptors.length - 1;
  const middleIndex = Math.floor(descriptors.length / 2);
  const lookupGroups = [
    {descriptor: descriptors[0], baseUrl: descriptors[0].direct},
    {descriptor: descriptors[middleIndex], baseUrl: descriptors[middleIndex].direct},
    {descriptor: descriptors[lastIndex], baseUrl: descriptors[lastIndex].direct},
    {descriptor: descriptors[lastIndex], baseUrl: descriptors[lastIndex].gateway},
  ];

  for (let index = 0; index < TRACE_OPERATIONS_PER_CATEGORY; index += 1) {
    operations.push({kind: 'wait', descriptor: descriptors[lastIndex]});
  }

  lookupGroups.forEach(({descriptor, baseUrl}, group) => {
    for (let index = 0; index < TRACE_OPERATIONS_PER_CATEGORY; index += 1) {
      operations.push({
        kind: 'lookup',
        descriptor,
        baseUrl,
        suffix: varied ? `/resource-${group}-${index}?request=${index}` : '/resource',
      });
    }
  });

  return shuffle(operations, seed);
}

function makeScenario(name, fixture, seed) {
  const {services, descriptors, implementation} = fixture;
  const lastIndex = descriptors.length - 1;
  const midpoint = Math.floor(descriptors.length / 2);
  const runLookup = (descriptor, baseUrl, suffix = '/resource') => {
    const result = services.getServiceFromUrl(`${baseUrl}${suffix}`);
    const expectedDefaultUrl = implementation === 'v2' ? baseUrl : descriptor.direct;

    assertLookupResult(result, descriptor, expectedDefaultUrl);

    return 1;
  };

  switch (name) {
    case 'name-hit': {
      const descriptor = descriptors[lastIndex];

      return {
        operationsPerRun: 1,
        async run() {
          const result = await services.waitForService({name: descriptor.name});

          assert.equal(result, descriptor.direct);

          return 1;
        },
      };
    }
    case 'invalid-url':
      return {
        operationsPerRun: 1,
        run() {
          assert.equal(services.getServiceFromUrl(''), undefined);

          return 0;
        },
      };
    case 'direct-early':
      return {
        operationsPerRun: 1,
        run: () => runLookup(descriptors[0], descriptors[0].direct),
      };
    case 'direct-middle':
      return {
        operationsPerRun: 1,
        run: () => runLookup(descriptors[midpoint], descriptors[midpoint].direct),
      };
    case 'direct-late':
      return {
        operationsPerRun: 1,
        run: () => runLookup(descriptors[lastIndex], descriptors[lastIndex].direct),
      };
    case 'gateway-late':
      return {
        operationsPerRun: 1,
        run: () => runLookup(descriptors[lastIndex], descriptors[lastIndex].gateway),
      };
    case 'unknown-host':
      return {
        operationsPerRun: 1,
        run() {
          assert.equal(
            services.getServiceFromUrl('https://unknown.example.com/resource'),
            undefined
          );

          return 0;
        },
      };
    case 'known-host-wrong-path':
      return {
        operationsPerRun: 1,
        run() {
          assert.equal(
            services.getServiceFromUrl(`https://${descriptors[lastIndex].gatewayHost}/wrong/path`),
            undefined
          );

          return 0;
        },
      };
    case 'trace-hot':
    case 'trace-varied': {
      const operations = createTraceOperations(descriptors, name === 'trace-varied', seed);

      return {
        operationsPerRun: operations.length,
        async run() {
          let checksum = 0;

          for (const operation of operations) {
            if (operation.kind === 'wait') {
              const expectedUrl = await services.waitForService({name: operation.descriptor.name});

              assert.equal(expectedUrl, operation.descriptor.direct);
              checksum += 1;
            } else {
              checksum += runLookup(operation.descriptor, operation.baseUrl, operation.suffix);
            }
          }

          return checksum;
        },
      };
    }
    default:
      throw new Error(`Unknown scenario: ${name}`);
  }
}

async function timeWarmScenario(scenario, iterations, targetSampleMs) {
  let checksum = 0;

  for (let index = 0; index < 3; index += 1) {
    checksum += await scenario.run();
  }

  const calibrationStart = performance.now();

  checksum += await scenario.run();

  const calibrationMs = Math.max(performance.now() - calibrationStart, 0.01);
  const batchSize = Math.max(1, Math.min(10000, Math.ceil(targetSampleMs / calibrationMs)));
  const samples = [];

  for (let sample = 0; sample < iterations; sample += 1) {
    const start = performance.now();

    for (let iteration = 0; iteration < batchSize; iteration += 1) {
      checksum += await scenario.run();
    }

    samples.push((performance.now() - start) / batchSize);
  }

  const summary = summarize(samples);

  return {
    ...summary,
    medianPerOperationMs: summary.medianMs / scenario.operationsPerRun,
    p95PerOperationMs: summary.p95Ms / scenario.operationsPerRun,
    batchSize,
    samples: iterations,
    checksum,
  };
}

async function runWorker(args) {
  const sdkRoot = path.resolve(args['sdk-root'] || DEFAULT_SDK_ROOT);
  const {implementation, scenario: scenarioName, mode} = args;
  const catalogSize = readPositiveInteger(
    args['catalog-size'],
    DEFAULT_CATALOG_SIZE,
    'catalog-size'
  );
  const iterations = readPositiveInteger(args.iterations, DEFAULT_ITERATIONS, 'iterations');
  const seed = readPositiveInteger(args.seed, DEFAULT_SEED, 'seed');
  const targetSampleMs = readPositiveInteger(
    args['target-sample-ms'],
    DEFAULT_TARGET_SAMPLE_MS,
    'target-sample-ms'
  );

  if (!['legacy', 'v2'].includes(implementation)) {
    throw new Error('--implementation must be legacy or v2 in worker mode');
  }

  if (!SCENARIOS.includes(scenarioName)) {
    throw new Error(`Unknown scenario: ${scenarioName}`);
  }

  if (catalogSize % URLS_PER_SERVICE !== 0) {
    throw new Error(`--catalog-size must be divisible by ${URLS_PER_SERVICE}`);
  }

  const fixture = buildFixture({
    sdkRoot,
    implementation,
    instrumented: mode === 'diagnostic',
    catalogSize,
  });
  const scenario = makeScenario(scenarioName, fixture, seed);
  const result = {
    implementation,
    scenario: scenarioName,
    mode,
    catalogSize,
    operationsPerRun: scenario.operationsPerRun,
  };

  if (mode === 'diagnostic') {
    const uninstallDiagnostics = installDiagnostics(fixture, implementation);

    try {
      result.checksum = await scenario.run();
      result.counters = fixture.counters;
    } finally {
      uninstallDiagnostics();
    }
  } else if (mode === 'cold') {
    const start = performance.now();

    result.checksum = await scenario.run();
    result.elapsedMs = performance.now() - start;
    result.elapsedPerOperationMs = result.elapsedMs / scenario.operationsPerRun;
  } else if (mode === 'warm') {
    Object.assign(result, await timeWarmScenario(scenario, iterations, targetSampleMs));
  } else {
    throw new Error('--mode must be diagnostic, cold, or warm in worker mode');
  }

  return result;
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

function makeWorkerArguments(options, implementation, scenario, mode) {
  return [
    '--sdk-root',
    options.sdkRoot,
    '--implementation',
    implementation,
    '--scenario',
    scenario,
    '--mode',
    mode,
    '--catalog-size',
    String(options.catalogSize),
    '--iterations',
    String(options.iterations),
    '--seed',
    String(options.seed),
    '--target-sample-ms',
    String(options.targetSampleMs),
  ];
}

function runCase(options, implementation, scenario) {
  const result = {implementation, scenario};
  const modes = options.mode === 'all' ? ['diagnostic', 'warm', 'cold'] : [options.mode];

  if (modes.includes('diagnostic')) {
    result.diagnostic = runChild(
      makeWorkerArguments(options, implementation, scenario, 'diagnostic')
    );
  }

  if (modes.includes('warm')) {
    result.warm = runChild(makeWorkerArguments(options, implementation, scenario, 'warm'));
  }

  if (modes.includes('cold')) {
    const samples = [];
    let lastColdResult;

    for (let iteration = 0; iteration < options.iterations; iteration += 1) {
      lastColdResult = runChild(makeWorkerArguments(options, implementation, scenario, 'cold'));
      samples.push(lastColdResult.elapsedMs);
    }

    const summary = summarize(samples);

    result.cold = {
      ...summary,
      medianPerOperationMs: summary.medianMs / lastColdResult.operationsPerRun,
      p95PerOperationMs: summary.p95Ms / lastColdResult.operationsPerRun,
      samples: options.iterations,
      checksum: lastColdResult.checksum,
      operationsPerRun: lastColdResult.operationsPerRun,
    };
  }

  return result;
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
  process.stdout.write('  --scenario <name>|all             Default: trace-hot\n');
  process.stdout.write('  --mode diagnostic|warm|cold|all   Default: all\n');
  process.stdout.write('  --catalog-size <number>            Default: 3000 URLs\n');
  process.stdout.write('  --iterations <number>              Default: 15\n');
  process.stdout.write('  --seed <number>                    Default: 5230\n');
  process.stdout.write('  --target-sample-ms <number>        Default: 100\n');
  process.stdout.write('  --sdk-root <trusted-checkout>      Default: current checkout\n');
  process.stdout.write('  --json                             Emit machine-readable JSON\n');
  process.stdout.write('  --help                             Show this help\n\n');
  process.stdout.write(`Scenarios:\n  ${SCENARIOS.join('\n  ')}\n`);
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
    `catalog=${report.options.catalogSize} URLs seed=${report.options.seed} ` +
      `iterations=${report.options.iterations}\n`
  );

  report.results.forEach((result) => {
    process.stdout.write(`\n${result.implementation} / ${result.scenario}\n`);

    if (result.diagnostic) {
      process.stdout.write(`  diagnostic ${JSON.stringify(result.diagnostic.counters)}\n`);
    }

    if (result.warm) {
      process.stdout.write(
        `  warm median=${formatMilliseconds(result.warm.medianMs)} ` +
          `p95=${formatMilliseconds(result.warm.p95Ms)} ` +
          `per-op=${formatMilliseconds(result.warm.medianPerOperationMs)}\n`
      );
    }

    if (result.cold) {
      process.stdout.write(
        `  cold median=${formatMilliseconds(result.cold.medianMs)} ` +
          `p95=${formatMilliseconds(result.cold.p95Ms)} ` +
          `per-op=${formatMilliseconds(result.cold.medianPerOperationMs)}\n`
      );
    }
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
  const scenario = args.scenario || 'trace-hot';
  const mode = args.mode || 'all';
  const catalogSize = readPositiveInteger(
    args['catalog-size'],
    DEFAULT_CATALOG_SIZE,
    'catalog-size'
  );
  const iterations = readPositiveInteger(args.iterations, DEFAULT_ITERATIONS, 'iterations');
  const seed = readPositiveInteger(args.seed, DEFAULT_SEED, 'seed');
  const targetSampleMs = readPositiveInteger(
    args['target-sample-ms'],
    DEFAULT_TARGET_SAMPLE_MS,
    'target-sample-ms'
  );
  const sdkRoot = path.resolve(args['sdk-root'] || DEFAULT_SDK_ROOT);

  if (!['legacy', 'v2', 'both'].includes(implementation)) {
    throw new Error('--implementation must be legacy, v2, or both');
  }

  if (scenario !== 'all' && !SCENARIOS.includes(scenario)) {
    throw new Error(`--scenario must be one of: all, ${SCENARIOS.join(', ')}`);
  }

  if (!['diagnostic', 'warm', 'cold', 'all'].includes(mode)) {
    throw new Error('--mode must be diagnostic, warm, cold, or all');
  }

  if (catalogSize % URLS_PER_SERVICE !== 0) {
    throw new Error(`--catalog-size must be divisible by ${URLS_PER_SERVICE}`);
  }

  const options = {sdkRoot, catalogSize, iterations, seed, targetSampleMs, mode};
  const implementations = implementation === 'both' ? ['legacy', 'v2'] : [implementation];
  const scenarios = scenario === 'all' ? SCENARIOS : [scenario];
  const cpu = os.cpus()[0];
  const report = {
    environment: {
      commit: getCommit(sdkRoot),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cpu: cpu ? cpu.model : 'unknown',
    },
    options: {catalogSize, iterations, seed, mode},
    results: [],
  };

  implementations.forEach((implementationName) => {
    scenarios.forEach((scenarioName) => {
      report.results.push(runCase(options, implementationName, scenarioName));
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
