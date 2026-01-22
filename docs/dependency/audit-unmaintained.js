// docs/dependency/audit-unmaintained.js
// Usage:
//   node docs/dependency/audit-unmaintained.js
// Optional env:
//   STALE_YEARS=2       (default 2)
//   CONCURRENCY=20      (default 20)
// e.g:
//   STALE_YEARS=3 CONCURRENCY=10 node docs/dependency/audit-unmaintained.js

const fs = require('fs');
const https = require('https');
const path = require('path');

const STALE_YEARS = Number(process.env.STALE_YEARS || 2);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);
const CATALOG_PATH = path.join('docs', 'dependency', 'unmaintained-catalog.md');
const SNAPSHOT_DIR = path.join('docs', 'dependency', 'snapshots');
const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
];

function log(...args) {
  /* eslint-disable-next-line no-console */
  console.log(...args);
}

function errorLog(...args) {
  /* eslint-disable-next-line no-console */
  console.error(...args);
}

function fetchJSON(url, headers = {}) {
  return new Promise((resolve) => {
    const opts = new URL(url);

    opts.headers = Object.assign({'User-Agent': 'dependency-audit-script'}, headers);

    const req = https.get(opts, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            resolve(null);

            return;
          }

          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });
  });
}

function yearsSince(dateStr) {
  if (!dateStr) {
    return Infinity;
  }
  const d = new Date(dateStr);

  if (Number.isNaN(d.getTime())) {
    return Infinity;
  }

  return (Date.now() - d.getTime()) / (1000 * 3600 * 24 * 365);
}

function ensureCatalogHeader() {
  const header = [
    '# Unmaintained / Suspect NPM Dependencies Catalog',
    '',
    'This file lists dependencies that were detected as unmaintained or suspect. Each line is added the first time the dependency is flagged.',
    '',
    '| Date | Package | Version | source | Reason | Evidence | Severity | Decision | Notes |',
    '| ---- | ------ | -------  | ------ | ------ | -------- | -------- | -------- | ----- |',
    '',
  ].join('\n');

  const dir = path.dirname(CATALOG_PATH);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }
  // If the file does not exist, or exists but is empty, write the header.
  try {
    const st = fs.existsSync(CATALOG_PATH) ? fs.statSync(CATALOG_PATH) : null;

    if (!st || st.size === 0) {
      fs.writeFileSync(CATALOG_PATH, header, 'utf8');
    } else {
      // If file exists but doesn't contain a header-like row, prepend our canonical header.
      const content = fs.readFileSync(CATALOG_PATH, 'utf8');

      // Use a whitespace-insensitive regex to detect an existing Date|Package header
      const headerRegex = /^\|\s*Date\s*\|\s*Package\s*\|/im;

      if (!headerRegex.test(content)) {
        fs.writeFileSync(CATALOG_PATH, `${header}\n${content}`, 'utf8');
      }
    }
  } catch (e) {
    // best-effort, non-fatal
    try {
      if (!fs.existsSync(CATALOG_PATH)) {
        fs.writeFileSync(CATALOG_PATH, header, 'utf8');
      }
    } catch (e2) {
      /* ignore */
    }
  }
}

function readExistingPackages() {
  if (!fs.existsSync(CATALOG_PATH)) {
    return new Set();
  }
  const content = fs.readFileSync(CATALOG_PATH, 'utf8');
  const lines = content.split('\n');
  const set = new Set();

  for (const l of lines) {
    // Expect rows like: | Date | Package | Version | source | Reason | ... |
    const m = l.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*([^|]+)\s*\|/);

    if (m) {
      set.add(m[2].trim());
    }
  }

  return set;
}

function formatEvidence(details) {
  const parts = [];

  if (details.npmPublish) {
    parts.push(`npm_last_publish:${details.npmPublish}`);
  }
  if (typeof details.deprecated !== 'undefined') {
    parts.push(`deprecated:${details.deprecated}`);
  }

  return parts.join(' ; ');
}

function decideSeverity({deprecated, yearsSincePublish}) {
  if (deprecated && yearsSincePublish >= STALE_YEARS) {
    return 'Critical';
  }
  if (deprecated || yearsSincePublish >= STALE_YEARS) {
    return 'High';
  }
  if (yearsSincePublish >= STALE_YEARS / 2) {
    return 'Medium';
  }

  return 'Low';
}

function asyncPool(poolLimit, array, iteratorFn) {
  let i = 0;
  const ret = [];
  const executing = [];
  const enqueue = function enqueue() {
    if (i === array.length) {
      return Promise.resolve();
    }
    const item = array[i];
    const idx = i;

    i += 1;
    const p = Promise.resolve().then(() => iteratorFn(item, idx, array));

    ret.push(p);

    const e = p.then(() => executing.splice(executing.indexOf(e), 1));

    executing.push(e);

    let r = Promise.resolve();

    if (executing.length >= poolLimit) {
      r = Promise.race(executing);
    }

    return r.then(() => enqueue());
  };

  return enqueue().then(() => Promise.all(ret));
}

function readPackageDeps(pkgJsonPath) {
  if (!fs.existsSync(pkgJsonPath)) {
    return {};
  }

  const content = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const result = {};

  for (const field of DEP_FIELDS) {
    if (content[field]) {
      Object.assign(result, content[field]);
    }
  }

  return result;
}

function readDirSafe(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true });
}

function hasPackageJson(dir) {
  return fs.existsSync(path.join(dir, 'package.json'));
}

async function main() {
  log('Running dependency audit (manual)...');
  ensureCatalogHeader();
  const existing = readExistingPackages();

  log('Scan start: scan range (package.json, packages/*/*/package.json, packages/*/package.json, dependencies including devDependencies)');

  const ROOT_DIR = process.cwd();
  const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');
  const flatDeps = [];

  function mergeDeps(source, deps) {
    for (const [name, version] of Object.entries(deps)) {
      // Dependencies prefixed with '@webex' are excluded. 
      // Only truly external third-party dependencies are retained, 
      // since '@webex' packages are internal submodules that reference each other within the repository.
      if (name.startsWith('@webex')) {
        continue;
      }
      flatDeps.push({
        name,
        version,
        source
      });
    }
  }

  try {
    const rootPkgPath = path.join(ROOT_DIR, 'package.json');

    if (!fs.existsSync(rootPkgPath)) {
      errorLog('package.json not found; cannot build dependency list in quick mode.');
      process.exit(1);
    }
    // case 1: root-level package.json
    mergeDeps('root', readPackageDeps(rootPkgPath));

    // packages/*
    for (const entry of readDirSafe(PACKAGES_DIR)) {
      if (!entry.isDirectory()) continue;

      const entryPath = path.join(PACKAGES_DIR, entry.name);

      // case 2: package-level package.json (packages/*)
      if (hasPackageJson(entryPath)) {
        const pkgJsonPath = path.join(entryPath, 'package.json');
        mergeDeps(
          `packages/${entry.name}`,
          readPackageDeps(pkgJsonPath)
        );
        continue;
      }

      // case 3: nested package.json (packages/*/*)
      for (const subEntry of readDirSafe(entryPath)) {
        if (!subEntry.isDirectory()) continue;

        const subPath = path.join(entryPath, subEntry.name);
        const pkgJsonPath = path.join(subPath, 'package.json');

        if (!fs.existsSync(pkgJsonPath)) continue;

        mergeDeps(
          `packages/${entry.name}/${subEntry.name}`,
          readPackageDeps(pkgJsonPath)
        );
      }
    }
  } catch (e) {
    errorLog('Failed to parse package.json:', e.message || e);
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const candidates = [];

  const tableHeader = '| Date | Package | Version | Source | Reason | Evidence | Severity | Decision | Notes |';
  const tableSep = '| ---- | ------ | ------- | ------ | ------ | -------- | -------- | -------- | ----- |';

  // process packages with concurrency
  await asyncPool(CONCURRENCY, flatDeps, async ({name, version, source}) => {
    try {
      const npmUrl = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
      const npmMeta = await fetchJSON(npmUrl);

      if (!npmMeta) {
        return;
      }

      const {latest} = npmMeta['dist-tags'] || {};
      const time = npmMeta.time || {};
      const npmLastPublish =
        time[latest] ||
        time.modified ||
        (Object.keys(time).length
          ? Object.keys(time)
              .filter((k) => k !== 'created' && k !== 'modified')
              .sort()
              .pop()
          : null);

      let deprecated = false;

      try {
        const latestTag = (npmMeta['dist-tags'] && npmMeta['dist-tags'].latest) || null;

        if (latestTag && npmMeta.versions && npmMeta.versions[latestTag]) {
          deprecated = !!npmMeta.versions[latestTag].deprecated;
        } else if (typeof npmMeta.deprecated !== 'undefined') {
          deprecated = !!npmMeta.deprecated;
        }
      } catch (e) {
        deprecated = !!npmMeta.deprecated;
      }

      const yearsSincePublish = yearsSince(npmLastPublish);

      const isStale = yearsSincePublish >= STALE_YEARS || deprecated;

      const severity = decideSeverity({deprecated, yearsSincePublish});

      // collect candidate data for possible initial population
      candidates.push({
        name,
        version,
        source,
        npmLastPublish,
        yearsSincePublish,
        deprecated,
        isStale,
        severity,
      });

      if (!isStale) {
        return; // healthy package
      }

      if (existing.has(name)) {
        return; // already cataloged
      }

      const reasonParts = [];

      if (deprecated) {
        reasonParts.push('deprecated');
      }
      if (yearsSincePublish !== Infinity && yearsSincePublish >= STALE_YEARS) {
        reasonParts.push(`npm_stale(${Math.floor(yearsSincePublish)}y)`);
      }

      const evidence = formatEvidence({npmPublish: npmLastPublish || 'unknown', deprecated});
      // Include all severities (Critical -> Low). Manual review can decide action.

      rows.push({
        date: today,
        name,
        version,
        source,
        reason: reasonParts.join('; '),
        evidence,
        severity,
        decision: '',
        notes: '',
      });
    } catch (e) {
      // ignore per-package errors
    }
  });

  // If no rows found but the master catalog is empty, perform an initial relaxed population
  try {
    const masterContentCheck = fs.existsSync(CATALOG_PATH) ? fs.readFileSync(CATALOG_PATH, 'utf8') : '';
    // quick check: does master contain any data rows (lines starting with a date)
    const hasData = masterContentCheck.split('\n').some((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l));

    if (rows.length === 0 && !hasData && candidates.length > 0) {
      // Tighten relaxed-first-run: only include deprecated packages or those that meet STALE_YEARS
      const relaxed = candidates.filter((c) => {
        if (c.deprecated) {
          return true;
        }
        if (!Number.isFinite(c.yearsSincePublish)) {
          return false;
        }

        return c.yearsSincePublish >= STALE_YEARS;
      });

      for (const c of relaxed) {
        if (!existing.has(c.name)) {
          const reasonParts = [];

          if (c.deprecated) {
            reasonParts.push('deprecated');
          }
          if (Number.isFinite(c.yearsSincePublish) && c.yearsSincePublish >= STALE_YEARS) {
            reasonParts.push(`npm_stale(${Math.floor(c.yearsSincePublish)}y)`);
          }

          const evidence = formatEvidence({npmPublish: c.npmLastPublish || 'unknown', deprecated: c.deprecated});

          rows.push({
            date: today,
            name: c.name,
            version: c.version,
            source: c.source,
            reason: reasonParts.join('; '),
            evidence,
            severity: c.severity || 'Low',
            decision: '',
            notes: '',
          });
        }
      }
    }
  } catch (e) {
    // best-effort: ignore and continue
  }

  // print table to stdout (markdown)
  if (rows.length > 0) {
    log(`\n${tableHeader}`);
    log(tableSep);
    for (const r of rows) {
      const rowLine = `| ${r.date} | ${r.name} | ${r.version} | ${r.source} | ${r.reason} | ${r.evidence} | ${r.severity} | ${r.decision} | ${r.notes} |`;

      log(rowLine);
    }
    log('\n');
  }

  if (rows.length === 0) {
    log('No new unmaintained dependencies detected.');

    try {
      if (!fs.existsSync(SNAPSHOT_DIR)) {
        fs.mkdirSync(SNAPSHOT_DIR, {recursive: true});
      }
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const snapPath = path.join(SNAPSHOT_DIR, `unmaintained-${ts}.md`);
      const snapHeader = `${tableHeader}\n${tableSep}\n`;

      const snapNote = `> No unmaintained dependencies detected on ${new Date().toISOString()}`;

      fs.writeFileSync(snapPath, `${snapHeader}${snapNote}\n`, 'utf8');
      log(`Snapshot written: ${snapPath}`);
    } catch (e) {
      errorLog('Failed to write snapshot:', e && e.message);
    }

    return;
  }

  // Write snapshot for this run (immutable record)
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
      fs.mkdirSync(SNAPSHOT_DIR, {recursive: true});
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const snapPath = path.join(SNAPSHOT_DIR, `unmaintained-${ts}.md`);
    const snapContent = `${tableHeader}\n${tableSep}\n${rows
      .map(
        (r) =>
          `| ${r.date} | ${r.name} | ${r.version} | ${r.source} | ${r.reason} | ${r.evidence} | ${r.severity} | ${r.decision} | ${r.notes} |`
      )
      .join('\n')}\n`;

    fs.writeFileSync(snapPath, snapContent, 'utf8');
    log(`Snapshot written: ${snapPath}`);
  } catch (e) {
    errorLog('Failed to write snapshot:', e && e.message);
  }

  // Merge into master catalog: preserve Decision/Notes for existing entries
  function parseCatalogToMap(content) {
    const map = new Map();
    const lines = content.split('\n');

    for (const line of lines) {
      if (!line.startsWith('|')) {
        // not a table row
      } else if (/^\|\s*-/.test(line)) {
        // separator row, ignore
      } else {
        // split into cols, trim
        const cols = line.split('|').map((c) => c.trim());

        // cols without No.: ['', Date, Package, Version, Reason, Evidence, Severity, Decision, Notes, '']
        if (cols.length >= 10) {
          // skip header rows (they include the word 'Package' or 'package')
          const hasHeaderWord = cols.some((c) => (c || '').toLowerCase() === 'package');

          if (!hasHeaderWord) {
            const pkg = cols[2];

            if (pkg) {
              map.set(pkg, {
                date: cols[1],
                name: pkg,
                version: cols[3],
                source: cols[4],
                reason: cols[5],
                evidence: cols[6],
                severity: cols[7],
                decision: cols[8] || '',
                notes: cols[9] || '',
              });
            }
          }
        }
      }
    }

    return map;
  }

  // read existing master
  let masterMap = new Map();

  try {
    const masterContent = fs.existsSync(CATALOG_PATH) ? fs.readFileSync(CATALOG_PATH, 'utf8') : '';

    masterMap = parseCatalogToMap(masterContent);
  } catch (e) {
    // if parse fails, start fresh
    masterMap = new Map();
  }

  // merge rows
  for (const r of rows) {
    const found = masterMap.get(r.name);

    if (found) {
      // preserve decision/notes
      masterMap.set(r.name, {
        date: r.date,
        name: r.name,
        version: r.version,
        source: r.source,
        reason: r.reason,
        evidence: r.evidence,
        severity: r.severity,
        decision: found.decision || '',
        notes: found.notes || '',
      });
    } else {
      masterMap.set(r.name, Object.assign({}, r));
    }
  }

  // build master content (header + rows in insertion order)
  const masterRows = [];

  for (const [, v] of masterMap) {
    masterRows.push(
      `| ${v.date} | ${v.name} | ${v.version} | ${v.source} | ${v.reason} | ${v.evidence} | ${v.severity} | ${v.decision} | ${v.notes} |`
    );
  }

  const masterContentOut = `${tableHeader}\n${tableSep}\n${masterRows.join('\n')}\n`;

  fs.writeFileSync(CATALOG_PATH, masterContentOut, 'utf8');
  log(`Catalog updated: merged ${rows.length} new entr${rows.length > 1 ? 'ies' : 'y'} -> ${CATALOG_PATH}`);
  const noteMsg =
    "Note: 'Decision' column left blank for manual review. Please open PR to update decisions and remediation actions.";

  log(noteMsg);
}

main().catch((e) => {
  errorLog('Unexpected error:', e);
  process.exit(1);
});
