# Service URL lookup benchmark

This benchmark measures service-name and service-URL lookup behavior against a deterministic,
synthetic catalog. It performs no network requests, reads no credentials, and uses only reserved
`example.com` hostnames.

The default catalog contains 1,500 services with two URLs each, for 3,000 catalog URLs total. The
benchmark validates every result while measuring it, so a fast but incorrect lookup fails the run.

## Run

From the repository root:

```sh
yarn workspace @webex/webex-core benchmark:service-url-lookups
```

The default command benchmarks legacy and V2 with three separate measurements:

- catalog ingestion only;
- a warmed, balanced 500-operation lookup trace;
- ingestion followed by that lookup trace in a fresh process.

The balanced trace contains:

- 100 service-name hits;
- 100 early direct-URL matches;
- 100 middle direct-URL matches;
- 100 late direct-URL matches;
- 100 late shared-gateway matches.

Each measurement reports median and p95 duration across 15 fresh-process samples. It also runs an
untimed diagnostic sample that counts catalog ingestion calls, service-name lookups, URL lookups,
catalog scans, catalog URL reads, alternate-host reads, and `URL` constructor attempts. Process
startup and module loading are excluded from the measured duration. This synthetic mix is
intentionally independent of any particular application flow.

Useful focused runs:

```sh
# Machine-readable results for all three measurements
yarn workspace @webex/webex-core benchmark:service-url-lookups --json

# Measure only warmed V2 lookup behavior
yarn workspace @webex/webex-core benchmark:service-url-lookups \
  --implementation v2 --phase lookup

# Run a quicker local survey
yarn workspace @webex/webex-core benchmark:service-url-lookups \
  --iterations 5
```

Run `yarn workspace @webex/webex-core benchmark:service-url-lookups --help` for every option and
scenario.

## Compare checkouts

Build `@webex/webex-core` from inside the target checkout first. Then, from a checkout that contains
this benchmark, invoke the script with the target's path:

```sh
# Run in the target checkout.
yarn workspace @webex/webex-core build:src

# Run in the checkout that contains this benchmark.
node packages/@webex/webex-core/benchmarks/service-url-lookups.js \
  --sdk-root /path/to/trusted/webex-js-sdk-checkout --json
```

Only use `--sdk-root` with a checkout you trust: the benchmark loads and executes that checkout's
built `@webex/webex-core` code. The checkout path is not included in benchmark output.

## Interpreting results

- `ingestion` measures loading 3,000 URLs through the public catalog update methods.
- `lookup` loads the catalog outside the timer, performs three warm-up traces, then measures one
  500-operation trace. This includes the steady-state effect of lazy caches.
- `combined` measures catalog ingestion plus the first 500 operations in a fresh process. This
  includes lazy work deferred from ingestion to the first lookups.
- `diagnostic` counters are collected separately from timing runs so instrumentation does not skew
  duration results.

Wall-clock results vary by machine and should be compared using the same Node.js version and
hardware. This benchmark intentionally defines no pass/fail timing threshold and is not a required
pull-request check.
