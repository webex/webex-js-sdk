# CI merge requirements: findings for maintainer review

Observed: 24 November 2026.

Repository baseline: [`next` at `a79d396337`](https://github.com/webex/webex-js-sdk/tree/a79d396337f524ad47ae8e72fdd76ec9d9a30647).
Example PR: [#5422](https://github.com/webex/webex-js-sdk/pull/5422), including head commit
[`1ed13a5450`](https://github.com/webex/webex-js-sdk/commit/1ed13a5450f9bc6afc1ae5a28944f838ef19a76e).

## Summary

PR CI reports different check names depending on how it starts. The existing
`next` branch protection requires the names produced by direct workflow runs,
while CI following a new push reports names with an additional prefix. GitHub
does not match the latter checks to those requirements.

Integration tests are also absent from the required-check list observed during
this investigation. A cancelled integration job therefore does not, by itself,
fail a matching merge requirement.

These are observations about workflow execution and repository settings, not a
claim that a PR with these mismatches can necessarily be merged. Missing
required checks, reviews, branch freshness, draft state and bypass permissions
can independently affect merge eligibility.

This report proposes a follow-up discussion. It changes no workflows or branch
protection settings. An integration requirement briefly added during the
investigation was removed before this report; the original five requirements
and their strict setting were verified after removal.

## 1. The same tests produce two sets of names

[`pull-request.yml`](../.github/workflows/pull-request.yml) runs directly for
`pull_request_target` events of types `opened`, `labeled` and `reopened`. It also
supports `workflow_call`.

On new pushes,
[`remove-validated-on-synchronize.yml`](../.github/workflows/remove-validated-on-synchronize.yml)
can invoke that workflow through a job named `Pull Request CI`, after its trust
and label checks. GitHub includes that caller job name in the resulting checks.

| Test        | Direct PR-event run  | Reusable run following a push          |
| ----------- | -------------------- | -------------------------------------- |
| Unit        | `Test - Unit`        | `Pull Request CI / Test - Unit`        |
| Coverage    | `Test - Coverage`    | `Pull Request CI / Test - Coverage`    |
| Browser     | `Test - Browser`     | `Pull Request CI / Test - Browser`     |
| Syntax      | `Test - Syntax`      | `Pull Request CI / Test - Syntax`      |
| Style       | `Test - Style`       | `Pull Request CI / Test - Style`       |
| Integration | `Test - Integration` | `Pull Request CI / Test - Integration` |

Evidence from actual runs:

- [Run 44744051127](https://github.com/webex/webex-js-sdk/actions/runs/44744051127)
  on commit `bd8ec7bc58` reported the shorter names.
- [Run 45384240195](https://github.com/webex/webex-js-sdk/actions/runs/45384240195)
  on commit `1ed13a5450` reported the prefixed names.

This is GitHub's documented naming behavior: a normal job uses its job name;
a reusable workflow job uses `<job name> / <reusable job name>`. Required checks
are not regex or suffix matches that make these two names interchangeable.
See [GitHub's check-name guidance](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#troubleshooting-required-status-checks).

## 2. Observed branch protection matches only the shorter names

A read of
`GET /repos/webex/webex-js-sdk/branches/next/protection/required_status_checks`
returned `strict: true` and these requirements, all associated with the GitHub
Actions app (`app_id: 15368`):

```text
Test - Unit
Test - Coverage
Test - Browser
Test - Syntax
Test - Style
```

Neither integration check name is in that list.

For additional confirmation, GitHub's GraphQL API was queried for each
`CheckRun.isRequired(pullRequestNumber: 5422)` on commit `1ed13a5450`. All six
prefixed test checks returned `false` after restoring the original settings.
There were no separate commit statuses bridging the shorter names on that SHA.

The controlled draft experiments in section 5 independently reproduce these
API classifications. The settings therefore match direct runs, but the successful prefixed checks
from the push path do not satisfy those configured names. This can leave the
required shorter checks expected/pending despite a green workflow run.

Simply renaming all requirements to the prefixed names reverses the mismatch:
direct runs still emit the shorter names. Requiring both sets would also require
both sets to be reported for a commit. The execution paths should first agree on
the names used for merge requirements.

## 3. A grey cancelled result is not a successful check

In [integration job 138347712650](https://github.com/webex/webex-js-sdk/actions/runs/45365701751/job/138347712650),
the `webex` suite reported `10 passing (9s)` at 09:36 UTC, but its Node process
remained alive. The one-hour job limit eventually cancelled it. Both the job
and workflow APIs reported `conclusion: cancelled`, consistent with the grey
result shown in the UI.

The assertion summary was successful; the job was not. A cancelled or timed-out
check does not satisfy a matching required check. GitHub accepts successful,
skipped or neutral results for required status checks, so colour alone should
not be used to assess enforcement. See
[protected-branch requirements](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging)
and [check conclusions](https://docs.github.com/en/pull-requests/reference/status-checks).

The fixture lifecycle issue was subsequently addressed separately in PR #5422.
[Integration job 138412298103](https://github.com/webex/webex-js-sdk/actions/runs/45384240195/job/138412298103)
reported all ten tests passing in 16 seconds and the process exiting with code 0.
This confirms the distinction between passing assertions and a completed job.

## 4. Latest-commit results determine whether requirements are satisfied

A successful initial run is not automatically carried forward to later commits.
Required checks must be satisfied for the commit GitHub is evaluating; where a
test merge commit has checks, those can be evaluated instead of the head commit.
An earlier successful run does not resolve a name mismatch on the new commit.

Consequently, these are separate questions:

1. Did a particular workflow finish successfully?
2. Do its reported checks satisfy this branch's requirements for this commit?
3. Are the PR's other merge requirements satisfied?

See [GitHub's required-check troubleshooting guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks).

## 5. Controlled draft PR experiments

Three disposable draft PRs were opened as **Coread**, all based on `next` at
`a79d396337`. No merge was attempted. No workflow or branch protection setting
was changed for these experiments. The probe PRs are explicitly marked **DO NOT
MERGE** and should be closed after maintainer review.

The docs probe changes one Markdown file. Each test probe initially adds four
files (31 lines): a note, a private dependency-free `@webex/ci-gate-probe`
workspace, its native Node assertion script, and its lockfile entry. The fixture
has no dependents and performs no SDK or network operations. Its only test
scripts are unit and integration. Package-selection logs select the root and
this fixture; the test commands exclude the root, so only the fixture's scripts
run. Browser, coverage, syntax and style jobs can therefore succeed without
running package scripts in this fixture. Those green jobs do not demonstrate
SDK test coverage.

### Completed initial runs and the unvalidated push

| Experiment                                                                                | Commit       | Run                                                                           | Observed result                                                                                                       | GitHub `CheckRun.isRequired`                                    |
| ----------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [#5433: docs baseline](https://github.com/webex/webex-js-sdk/pull/5433)                   | `3d62a5da5a` | [45390276766](https://github.com/webex/webex-js-sdk/actions/runs/45390276766) | All six test jobs succeeded; package selection was empty                                                              | Five short test names required; integration not required        |
| [#5434: intentional unit failure](https://github.com/webex/webex-js-sdk/pull/5434)        | `8ccb31414d` | [45390400845](https://github.com/webex/webex-js-sdk/actions/runs/45390400845) | Unit failed; integration and the other four test jobs succeeded                                                       | Failed `Test - Unit`: `true`                                    |
| [#5435: intentional integration failure](https://github.com/webex/webex-js-sdk/pull/5435) | `ef43a532a3` | [45390540343](https://github.com/webex/webex-js-sdk/actions/runs/45390540343) | Integration failed; all five configured required test checks succeeded                                                | Failed `Test - Integration`: `false`                            |
| #5433: subsequent docs push, without `validated`                                          | `80ed234429` | [45391189540](https://github.com/webex/webex-js-sdk/actions/runs/45391189540) | Workflow succeeded; label job succeeded and `Pull Request CI` was skipped; no fresh test checks appeared on this head | None of the five required test names were reported on this head |

The unit log contains `CI_GATE_PROBE suite=unit outcome=fail`, followed by the
intentional assertion and process exit code 1. The integration log similarly
contains `CI_GATE_PROBE suite=integration outcome=fail` and exit code 1. These
were intended test failures, rather than installation or infrastructure errors.
The integration experiment produced a red overall workflow while the five
configured required test checks were green.

### Validated push and cancellation

The existing `validated` label was then applied to #5434 and #5435 before new
commits were pushed by Coread. The synchronization workflow retained the label
and started the reusable workflow path. A label event can also start a direct
run on the preceding commit; the observations below concern the new head and
its synchronization run, not that superseded run.

On #5434, commit `f62f832342` kept the same intentional unit failure. In
[run 45391747279](https://github.com/webex/webex-js-sdk/actions/runs/45391747279),
`Pull Request CI / Test - Unit` failed with the same assertion and exit code 1,
while the other five test jobs succeeded. GitHub reported `isRequired: false`
for that failed check and for every other prefixed test check. None of the five
required short names was reported on this head. This reproduces the mismatch
with a controlled failure rather than just comparing successful runs.

On #5435, commit `6f237427be` kept unit passing and changed integration to a
bounded 120-second cancellation window. In
[run 45391798649](https://github.com/webex/webex-js-sdk/actions/runs/45391798649),
the integration log recorded `CI_GATE_PROBE suite=integration outcome=wait`
and the cancellation-window marker at 12:21:15 UTC. After the test step was
observed running, cancellation was requested for this probe run alone. The
log reported `The operation was canceled` at 12:21:42 UTC. Both the integration
job and workflow finished with `conclusion: cancelled`; the other five test
jobs succeeded. The cancelled `Pull Request CI / Test - Integration` check
was classified `isRequired: false`.

This is a controlled cancellation, not a reproduction of the one-hour timeout
or proof of a new hanging-test defect. The fixture would fail after 120 seconds
if cancellation did not occur. It demonstrates the grey cancelled outcome and
its lack of a matching integration requirement without waiting an hour. The
missing required short names on this head remain a separate constraint.

### Rechecking the evidence

Run metadata and jobs can be read without relying on the latest PR check list:

```sh
gh api repos/webex/webex-js-sdk/actions/runs/45390400845/jobs
gh api repos/webex/webex-js-sdk/actions/runs/45390540343/jobs
gh api repos/webex/webex-js-sdk/branches/next/protection/required_status_checks
```

For a recorded commit SHA, query its check runs and use GraphQL
`CheckRun.isRequired(pullRequestNumber: 5434)` (or the corresponding probe PR
number). Required classification reflects current repository settings; it is
not an immutable part of the historical job result. The observations in the
table were captured while the original five requirements were in effect.

### Other observed gates (configuration evidence only)

A fresh read of `GET /repos/webex/webex-js-sdk/branches/next/protection`
also reported:

- Two approving reviews and code-owner review required.
- Stale reviews are not automatically dismissed; approval of the last push is
  not required.
- Strict status checks enabled (branch freshness is required).
- Administrator enforcement disabled; the `web-sdk-widget-admins` team is listed
  in PR-review bypass allowances.
- Push restrictions list the `web-client`, `web-sdk`, `wcme` and
  `epic-web-sdk-contributors` teams.
- Conversation resolution, signed commits and linear history are not required
  by this protection response.

`GET /repos/webex/webex-js-sdk/rules/branches/next` returned an empty list of
active ruleset rules. These settings were inspected, not tested by attempting a
merge, approval bypass or restricted push. All probe runs skipped the optional
`Test - E2E` job because no `test_e2e` label was applied; that check is absent
from the required-check list.

### What these experiments establish

The probes separate workflow colour from configured check requirements. They
confirm that direct unit failures match a required name, direct integration
failures do not, and an unvalidated push can finish its wrapper workflow green
without reporting the required test checks for that commit. A validated push
reproduces the unit failure under a different name that GitHub does not mark
required; the configured short names are missing on that head.

The PRs remain drafts, lack approving reviews and have not been merged. API
classification is evidence of the configured status-check requirement; it is
not a complete end-to-end demonstration of merge eligibility or administrator
bypass. The probes do not exercise external fork approval, a failed validation
job, merge queues, or deliberate failures in each of browser, coverage, syntax
and style. The empty-package docs case demonstrates legitimate zero-package
execution, not an unexpected skipped dependency being accepted by a gate.

## Proposed remediation plan

Recommendation: use one PR workflow entry point and one stable final required
check named `SDK CI Required`. That check should cover validation, package
selection and all six suites, including integration. Keep each suite's job
visible for diagnosis. This is a proposed implementation for a separate PR;
the findings PR changes documentation only.

### 1. Consolidate event handling before changing required checks

In [`.github/workflows/pull-request.yml`](../.github/workflows/pull-request.yml),
handle `opened`, `reopened`, `labeled` and `synchronize` through the same
top-level workflow. Move the membership/label handling from
[`.github/workflows/remove-validated-on-synchronize.yml`](../.github/workflows/remove-validated-on-synchronize.yml)
into an initial admission job, then retire that separate synchronize workflow.
Inventory any other callers before removing its `workflow_call` interface;
any retained reusable jobs must still feed the same top-level final check.

The admission job must run trusted workflow code without checking out or
executing the PR head. Preserve the current event-specific trust policy:

- Opening/reopening/labeling uses the existing same-repository or validated-PR
  policy. Document that same-repository PRs currently have different admission
  rules from new pushes; do not silently broaden either path.
- On synchronize, retain validation only for an active `webex/web-sdk` push
  actor, following the existing membership lookup and label-removal behavior.
  Missing or inconclusive membership must not authorize testing.
- Emit an explicit authorization result and the exact PR head SHA. Resolve
  current PR state and reject a stale event rather than authorizing a newer
  head using an older validation decision. Jobs must check out that exact SHA.
- Gate package selection, installation, builds and test jobs on authorization.
  Keep the organization-read token confined to the membership step, keep write
  permissions limited to jobs that need them, and expose test secrets only to
  authorized jobs. The final check needs neither PR code nor test secrets.

An unauthorized push must still produce a failing final check explaining that
maintainer validation is needed. Applying `validated` should start a fresh run
for the current head. This replaces the current green wrapper with no tests.

Use one PR-number concurrency group at the entry point, cancelling superseded
runs across all events. Do not place the entry point behind path filters. Keep
manual dispatch diagnostic unless it has a separately verified PR association;
GitHub documents that workflow-job checks from `workflow_dispatch` do not
satisfy PR requirements. Use a PR event or rerun the associated PR run to clear
the gate. See [required-check event guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated).

### 2. Make applicability and execution explicit

Extend `generate-package-matrix` to emit validated structured outputs: selected
packages for each suite, whether that suite is applicable, and why. Preserve
the current changed-package versus dependent-package scopes unless maintainers
approve a separate change. Determine applicability using the selected
packages' supported scripts, so a package without a browser script is not
mistaken for an executed browser suite.

Define valid zero-package cases, including docs-only edits. A failed diff,
malformed output or missing expected script must not become an empty successful
selection. Define an explicit mapping for shared tooling, workflow and global
configuration changes so they select the affected suites, or conservatively
select all suites, instead of accidentally behaving like docs-only changes.

Keep job summaries showing selected packages, scripts actually invoked, skip
reasons and the tested SHA. Where a suite is applicable, require successful
execution; where it is inapplicable, permit a skip only with successful
selection and an explicit reason. Build failures still fail the gate even if
there are no test assertion failures.

### 3. Add a final check that evaluates every outcome

Add a top-level job with the fixed name `SDK CI Required`. Give it `needs` on
admission, package selection and all six suite jobs, plus optional E2E if the
maintainers keep the `test_e2e` label policy. Use job-level `if: always()` so a
failed dependency does not automatically skip the final check. Evaluate all
`needs` results and applicability outputs in a small trusted gate evaluator.
The evaluator should have focused tests for the following decision table:

| Condition                                                            | Final check behavior                                                              |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Authorized head; selection succeeds; every applicable suite succeeds | Succeed                                                                           |
| Docs-only or a suite explicitly inapplicable                         | Succeed only with successful authorization/selection and documented applicability |
| Unit, integration, browser, coverage, syntax or style fails          | Fail                                                                              |
| Admission, selection, installation or build fails                    | Fail                                                                              |
| Applicable suite is skipped, cancelled, timed out or missing         | Never succeed                                                                     |
| Admission is denied or its result is missing                         | Fail with validation instructions                                                 |
| Optional E2E not requested                                           | Allow its documented skip                                                         |
| Optional E2E requested                                               | Require its success                                                               |

Integration must contribute exactly like unit and browser. Do not use
`continue-on-error` to hide a failed suite. Keep the current bounded job timeouts
initially; address a hanging test's resource cleanup in the owning package.
For new timeout probes, use a disposable short job limit rather than waiting
an hour or increasing production timeouts.

A cancelled workflow may prevent the evaluator from finishing. In that case,
the required check must remain absent/pending or cancelled, never successful,
neutral or skipped. Verify cancellation before scheduling, during testing and
while the final check is starting; `always()` alone is not sufficient evidence
that cancellation is safe. GitHub accepts skipped required jobs, so any path
that skips the final check is a release blocker for this design. See
[skipped-check guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#handling-skipped-but-required-checks)
and [status expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions).

### 4. Repeat controlled probes against the proposed workflows

Before changing protection, use fresh draft heads to verify:

- Passing package tests, explicit docs-only selection, and a package without a
  particular suite script.
- An intentional failure in each of the six suites; requested E2E failure if
  E2E remains label-controlled.
- Admission denied, membership lookup failure, selection failure, missing
  output and an unexpected skipped applicable suite.
- Controlled cancellation at the stages above and a short real job timeout.
- Initial opening, validated label application, trusted push, untrusted push
  and reopening, including the existing external-fork approval flow.
- A passing run followed by a failing new commit; rapid consecutive pushes and
  label/push races, verifying that only the authorized current SHA is tested.

For every case, record the head SHA, run/job URLs, final check name/conclusion
and the PR check list. Confirm one consistent final check name and no skipped
final check that could satisfy protection. On a safe passing case, compare
with a failing case in the merge box using an eligible non-bypass reviewer;
keep draft/review/freshness constraints distinct and do not merge a probe.
An implementation PR's green run on the old base workflows does not validate
its proposed workflows: exercise them on an isolated validation base or after
the workflow-only rollout, before switching requirements.

### 5. Roll out protection as a separate maintainer action

1. Merge a reviewed workflow/tooling PR implementing steps 1–3, with the old
   short test-job names retained and the existing five requirements unchanged.
   The unified entry point should emit those names on both open and push paths.
2. Complete step 4 on fresh commits using the deployed workflows. Make sure the
   new final check has reported successfully and is selectable in protection.
3. Add `SDK CI Required`, restricted to GitHub Actions, alongside the existing
   five requirements. Preserve `strict: true` and the current review settings.
   Re-read protection and confirm `CheckRun.isRequired` is true for the final
   check on fresh direct and push-triggered runs, including a failing probe.
4. Only after that verification, remove the five redundant individual
   requirements. Integration remains enforced through the final check. Do not
   require both short and prefixed versions of each suite.
5. Revalidate the effective policy without bypass; document the final settings
   and close the disposable probe PRs after review. Decide any administrator
   bypass or approval-policy changes separately; they are not needed to fix
   the test gate mismatch. Add `merge_group` support before adopting a merge
   queue, rather than expanding this change to queues now.

Rollback must keep a working gate: if the new requirement misbehaves, retain or
restore the five short requirements against the unified workflow before
removing the aggregate requirement. That restores the old five-suite policy
and temporarily loses the new integration guarantee; record that explicitly.
Do not revert to the split naming paths while protection expects only the new
check, or temporarily remove every required test check to unblock a merge.

## Decisions requested from maintainers

1. Approve integration as a required condition whenever applicable, as requested
   in this investigation.
2. Approve the proposed single entry point and aggregate check, or choose six
   consistently named individual requirements with equivalent admission and
   skip safeguards.
3. Confirm the current event-specific trust policy before consolidating it.
4. Agree the per-suite applicability rules and who owns the staged protection
   update and rollback.

The observed settings are a dated snapshot. Re-read live protection and check
results when implementing a follow-up; this document is not executable policy.
