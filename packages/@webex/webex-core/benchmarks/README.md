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

The default command benchmarks legacy and V2 lookups using a balanced 500-operation trace:

- 100 service-name hits;
- 100 early direct-URL matches;
- 100 middle direct-URL matches;
- 100 late direct-URL matches;
- 100 late shared-gateway matches.

It reports diagnostics, warmed timings, and cold-cache timings collected in fresh Node.js
processes. This synthetic mix is intentionally independent of any particular application flow.

Useful focused runs:

```sh
# Machine-readable results for the balanced trace
yarn workspace @webex/webex-core benchmark:service-url-lookups --json

# A shared gateway host whose matching service is late in the catalog
yarn workspace @webex/webex-core benchmark:service-url-lookups \
  --implementation v2 --scenario gateway-late

# A known host with no matching path
yarn workspace @webex/webex-core benchmark:service-url-lookups \
  --implementation both --scenario known-host-wrong-path

# Run every scenario with fewer samples for a quick local survey
yarn workspace @webex/webex-core benchmark:service-url-lookups \
  --scenario all --iterations 5
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

- `diagnostic` counts service lookups, catalog scans, catalog URL reads, alternate-host reads, and
  `URL` constructor attempts. Instrumentation is kept separate from timing runs.
- `warm` measures repeated operations after three warm-up runs.
- `cold` runs every sample in a fresh Node.js process so module-level caches start empty.
- `trace-hot` repeats a small set of URLs, while `trace-varied` uses unique resource paths and query
  strings with the same lookup distribution.

Wall-clock results vary by machine and should be compared using the same Node.js version and
hardware. This benchmark intentionally defines no pass/fail timing threshold and is not a required
pull-request check.
