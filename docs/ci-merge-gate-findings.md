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

The settings therefore match direct runs, but the successful prefixed checks
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

## Recommended follow-up

### Give both execution paths a consistent merge contract

Make the direct-event and new-push paths produce the same required check names.
Preserve the existing validation, fork/trust, secret-handling and concurrency
rules while doing so. This should be reviewed as a separate workflow change.

One option is a stable final check such as `CI / Required`, required in branch
protection. It would depend on validation, package selection, unit, integration,
browser, coverage, syntax and style. Requiring the six individual test checks is
also valid if their reported names are consistent across the trigger paths.

### Make an aggregate check evaluate all outcomes explicitly

If maintainers choose an aggregate check:

- Schedule it even after dependencies fail, using `needs` with `if: always()`.
- Require successful validation and package selection before accepting results.
- Treat failures, cancellations, timeouts and missing results as unsuccessful.
- Permit skips only when package selection explicitly establishes that the test
  is not applicable. Do not accept every skipped dependency automatically.
- Ensure an unvalidated PR cannot obtain a passing gate by skipping its tests.

GitHub treats skipped jobs as successful for merge requirements. A dependent
gate that is itself skipped can therefore fail to enforce the intended policy.
See [handling skipped required checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#handling-skipped-but-required-checks).

### Verify the policy before switching requirements

Exercise both direct and reusable paths on fresh commits, including:

- Successful tests.
- A deliberately failing test and an upstream validation failure.
- A cancelled run and a timed-out test job.
- An explicitly inapplicable package test and an unexpectedly skipped job.
- A new commit after an earlier successful run.
- The existing fork/trust approval flow.

Confirm the reported names and `CheckRun.isRequired` values through the API, as
well as the PR merge box. Then align the branch requirements with the verified
checks. Avoid assuming a workflow's green badge proves the merge policy works.

If merge queues are adopted, include the `merge_group` trigger so required
checks are reported for queued changes. Keep any administrator or emergency
bypass policy explicit and review it separately from check-name alignment.

## Decisions requested from maintainers

1. Should integration be a required merge condition whenever applicable?
2. Should protection require six stable test checks or one aggregate gate?
3. How should both trigger paths expose the same merge requirements while
   preserving the existing trust model?
4. Which package-selection skips are valid, and how should they be evidenced?

The observed settings are a dated snapshot. Re-read live protection and check
results when implementing a follow-up; this document is not executable policy.
