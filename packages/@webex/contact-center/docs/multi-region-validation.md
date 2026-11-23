# Multi-region local validation

Current cycle: `rf_825b48075e300a6057be48c7`. Package checks completed 2026-11-23T14:49:22.186380+00:00.

**Product verification passed.** 4,345 tests across 43 suites, zero failures or skips, and 265/265 exact named contracts. **Independent MR-11 review pass-with-warnings.** The five deployed and live release evidence items remain open.

SDK source and tests are frozen. All 61 pinned product inputs were byte-identical before and after the six-segment run. This report supersedes earlier current-status claims. Earlier report bytes and reviews are retained as historical evidence in the consolidated record; their hashes, counts and pass labels never certify this checkout. No browser, development server, live tenant or audio test ran.

Evidence record: `.matrix/validation-runs/rf_825b48075e300a6057be48c7/implementation-validation-report.json`. JSON fragment references below resolve inside that file.

## Prerequisite results

Runtime: Node `v22.14.0`, Yarn `3.4.1`, Jest `27.5.1`, package TypeScript `5.4.5`, ESLint `8.57.1`. The exact three pinned prerequisite commands passed. Their timestamps, exits and raw output are retained under `prerequisite_results`. An earlier extra package-version subpath probe failed and is retained separately as a diagnostic failure; it is not evidence of dependency unavailability.

The exact sealed first MR-11 command verified the already-admitted pre-authoring receipt before any canonical edit in this task. The receipt is unchanged and separate from the final review invocation. Its checked_at is 2026-11-23T02:51:20.943448+00:00; the successful receipt verification and first-write checkpoint are recorded under `preauthoring_receipt`. No Git state or commit identity is used for freshness.

## Baseline results

Earlier 4,102-test, 264/265-name, v8, focused nine-case and independent-review snapshots are historical. Their obsolete missing-T-009 and AC-014/015 partial claims are superseded by the fresh source/JUnit accounting below. The earlier report is retained losslessly as `#/retained_artifacts/superseded_product_report`; prior review findings remain in the immutable historical record links.

The package-local `@webex/jest-config-legacy` link resolves to the existing `.matrix/tools/ccsdk-jest-resume-54b3dd40/index.cjs`, forcing Babel and forceExit. Repository `packages/legacy/jest/static/index.js` selects v8. No resolver/configuration change is in scope. The current accepted design explicitly selects serial Babel coverage and forceExit for this bounded run; the earlier design/DAG no-override discrepancy is historical. **Unmodified repository-default v8 execution remains unproven.** The effective configuration, both config contents and SHA-256 digests are retained in `configuration_provenance`.

## Feature tests

All six exact MR-10 segments passed in order. Raw stdout/stderr, their SHA-256 digests, exact commands, start/end times and exits are retained under `command_results` and `mr10_results`. The full acceptance string is `mr10_exact_acceptance`. Header checks, style, cycles and declarations are separate from full coverage; no scoped or coverage-disabled result is used as package coverage.

| Segment | Started (UTC) | Finished (UTC) | Exit |
| --- | --- | --- | --- |
| mr10-report-sections | 2026-11-23T14:46:56.890786+00:00 | 2026-11-23T14:46:56.930733+00:00 | 0 |
| mr10-build | 2026-11-23T14:46:56.932966+00:00 | 2026-11-23T14:47:09.912203+00:00 | 0 |
| mr10-full-serial-babel-coverage | 2026-11-23T14:47:09.914258+00:00 | 2026-11-23T14:49:02.607289+00:00 | 0 |
| mr10-test-style | 2026-11-23T14:49:02.616091+00:00 | 2026-11-23T14:49:15.056222+00:00 | 0 |
| mr10-import-cycles | 2026-11-23T14:49:15.062302+00:00 | 2026-11-23T14:49:20.733238+00:00 | 0 |
| mr10-emitted-declarations | 2026-11-23T14:49:20.738137+00:00 | 2026-11-23T14:49:22.186380+00:00 | 0 |

Exact MR-10 commands:

```sh
node -e 'const fs=require('"'"'fs'"'"'),a=require('"'"'assert'"'"'),s=fs.readFileSync('"'"'packages/@webex/contact-center/docs/multi-region-validation.md'"'"','"'"'utf8'"'"'); for(const h of ['"'"'Prerequisite results'"'"','"'"'Baseline results'"'"','"'"'Feature tests'"'"','"'"'Independent spec review'"'"','"'"'Release evidence'"'"']) a(s.split(/\r?\n/).some(line=>line.replace(/^#{1,6}\s+/, '"'"''"'"').trim()===h),'"'"'Missing report section: '"'"'+h); console.log('"'"'Required local validation report sections present; outcomes remain explicit'"'"');' && yarn workspace @webex/contact-center build:src && NODE_OPTIONS=--max-old-space-size=8192 JEST_JUNIT_OUTPUT_DIR=coverage/junit JEST_JUNIT_OUTPUT_NAME=coverage-junit.xml yarn workspace @webex/contact-center exec jest --runInBand --forceExit --coverageProvider=babel --reporters=default --reporters=jest-junit && yarn workspace @webex/contact-center test:style && node -e 'const fs=require('"'"'fs'"'"'),path=require('"'"'path'"'"'),a=require('"'"'assert'"'"'),{ESLint}=require('"'"'eslint'"'"'),parser=require('"'"'@typescript-eslint/parser'"'"');
const name='"'"'touchedRecoveryImportCyclesAgainstBaseline'"'"';
const base='"'"'packages/@webex/contact-center/'"'"';
const baseline=[['"'"'src/constants.ts'"'"','"'"'./types'"'"','"'"'Dependency cycle via ./utils/PageCache=>../logger-proxy'"'"'],['"'"'src/services/task/state-machine/uiControlsComputer.ts'"'"','"'"'../types'"'"','"'"'Dependency cycle via ./state-machine=>./actions'"'"'],['"'"'src/services/task/types.ts'"'"','"'"'./state-machine'"'"','"'"'Dependency cycle via ./types'"'"'],['"'"'src/services/task/types.ts'"'"','"'"'./AutoWrapup'"'"','"'"'Dependency cycle via ../../logger-proxy=>./types'"'"'],['"'"'src/types.ts'"'"','"'"'./services/task/types'"'"','"'"'Dependency cycle via ./AutoWrapup=>../../logger-proxy'"'"']];
const allowed=new Map(); for(const [f,s,w] of baseline){const k=JSON.stringify([base+f,s,w]);allowed.set(k,(allowed.get(k)||0)+1);}
(async()=>{const dag=JSON.parse(fs.readFileSync('"'"'design/default/implementation_dag.json'"'"','"'"'utf8'"'"'));const files=[...new Set(dag.tasks.flatMap(t=>t.files).filter(f=>f.startsWith(base+'"'"'src/'"'"')&&f.endsWith('"'"'.ts'"'"')))].sort();a(files.length>0,'"'"'empty cycle-check scope'"'"');const lint=new ESLint({allowInlineConfig:false,overrideConfig:{rules:{'"'"'import/no-cycle'"'"':'"'"'warn'"'"'}}});for(const f of files)a(!(await lint.isPathIgnored(f)),'"'"'ignored cycle-check input: '"'"'+f);const results=await lint.lintFiles(files);a.strictEqual(results.length,files.length);const unexpected=[];let count=0;for(const r of results){const f=path.relative(process.cwd(),r.filePath).split(path.sep).join('"'"'/'"'"');a(!r.messages.some(m=>m.fatal||m.ruleId==='"'"'import/no-unresolved'"'"'||m.message.startsWith('"'"'Resolve error'"'"')),'"'"'cycle-check parser/resolver failure: '"'"'+f);const cycles=r.messages.filter(m=>m.ruleId==='"'"'import/no-cycle'"'"');if(!cycles.length)continue;const ast=parser.parse(fs.readFileSync(r.filePath,'"'"'utf8'"'"'),{loc:true,range:true,sourceType:'"'"'module'"'"'});for(const m of cycles){const n=ast.body.find(n=>n.source&&n.loc.start.line===m.line&&n.loc.start.column===m.column-1);a(n,'"'"'unmapped cycle diagnostic: '"'"'+f);const k=JSON.stringify([f,n.source.value,m.message.replace(/:\d+\b/g,'"'"''"'"')]);const remaining=allowed.get(k)||0;if(remaining>0)allowed.set(k,remaining-1);else unexpected.push(JSON.parse(k));count++;}}a.deepStrictEqual(unexpected,[],name+'"'"': new cycle warnings'"'"');console.log(name+'"'"': PASS; '"'"'+count+'"'"' existing warnings across '"'"'+files.length+'"'"' source files; ESLint '"'"'+ESLint.version);})().catch(e=>{console.error(e);process.exitCode=1;});' && node -e 'const fs=require('"'"'fs'"'"'),path=require('"'"'path'"'"'),a=require('"'"'assert'"'"'),ts=require(require.resolve('"'"'typescript'"'"',{paths:[path.resolve('"'"'packages/@webex/contact-center'"'"')]}));
const name='"'"'emittedTaskGuardDeclarationsCompatible'"'"';
const base=path.resolve('"'"'packages/@webex/contact-center'"'"'),dir=path.join(base,'"'"'dist/types'"'"'),file=path.join(dir,'"'"'__task_guard_consumer__.ts'"'"');
const text=`import TaskFactory from '"'"'./services/task/TaskFactory'"'"';
import type {TaskRecoveryGuard} from '"'"'./services/task/types'"'"';
import type * as PublicApi from '"'"'./index'"'"';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends\x20(1 & T) ? true : false;
type Args = Parameters<typeof TaskFactory.createTask>;
type GuardIsTyped = Assert<IsAny<Args[4]> extends true ? false : true>;
type GuardMatches = Assert<Args[4] extends TaskRecoveryGuard ? true : false>;
declare const args: Args;
declare const guard: TaskRecoveryGuard;
TaskFactory.createTask(args[0], args[1], args[2], args[3], guard);
// @ts-expect-error The fifth recovery guard is required.
TaskFactory.createTask(args[0], args[1], args[2], args[3]);
// @ts-expect-error The guard is not a root public API export.
type HiddenGuard = PublicApi.TaskRecoveryGuard;
`;
const c=ts.readConfigFile(path.join(base,'"'"'tsconfig.json'"'"'),ts.sys.readFile);a(!c.error,JSON.stringify(c.error));
const parsed=ts.parseJsonConfigFileContent(c.config,ts.sys,base);a.strictEqual(parsed.errors.length,0);
const options={...parsed.options,noEmit:true,declaration:false,emitDeclarationOnly:false};
const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host),read=host.readFile.bind(host),exists=host.fileExists.bind(host);
host.fileExists=f=>path.resolve(f)===file||exists(f);host.readFile=f=>path.resolve(f)===file?text:read(f);
host.getSourceFile=(f,v,onError,create)=>path.resolve(f)===file?ts.createSourceFile(f,text,v,true):get(f,v,onError,create);
const emitted=[];const collect=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory())collect(full);else if(entry.isFile()&&entry.name.endsWith('"'"'.d.ts'"'"'))emitted.push(full);}};collect(dir);a(emitted.length>0,'"'"'missing emitted declarations'"'"');
const program=ts.createProgram([file,...emitted],options,host),checker=program.getTypeChecker();
const diagnostics=ts.getPreEmitDiagnostics(program);a.strictEqual(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:f=>f,getNewLine:()=>String.fromCharCode(10)}));
const owner=path.join(dir,'"'"'services/task/types.d.ts'"'"'),source=program.getSourceFile(owner);a(source,'"'"'missing emitted task/types.d.ts'"'"');
const exported=checker.getExportsOfModule(checker.getSymbolAtLocation(source)).find(s=>s.name==='"'"'TaskRecoveryGuard'"'"');a(exported&&exported.declarations&&exported.declarations.length,'"'"'guard declaration was stripped'"'"');
let references=0;for(const sf of program.getSourceFiles().filter(s=>s.isDeclarationFile&&path.resolve(s.fileName).startsWith(dir+path.sep))){const visit=n=>{if(ts.isIdentifier(n)&&n.text==='"'"'TaskRecoveryGuard'"'"'){let symbol=checker.getSymbolAtLocation(n);a(symbol,'"'"'unresolved guard in '"'"'+sf.fileName);if(symbol.flags&ts.SymbolFlags.Alias)symbol=checker.getAliasedSymbol(symbol);a(symbol.declarations&&symbol.declarations.some(d=>path.resolve(d.getSourceFile().fileName)===owner),'"'"'dangling guard reference in '"'"'+sf.fileName);references++;}ts.forEachChild(n,visit);};visit(sf);}
a(references>1,'"'"'factory guard references missing'"'"');console.log(name+'"'"': PASS; '"'"'+references+'"'"' emitted references resolve; required guard and absent root export checked'"'"');'
```

The full unit command uses `--runInBand --forceExit --coverageProvider=babel`, 8 GiB Node heap and the configured unchanged 85% thresholds. JUnit and the full Istanbul map are retained losslessly, with their digests below. The coverage summary was recomputed directly from that map.

| Dimension | Covered / total | Percent | Required |
| --- | --- | --- | --- |
| statements | 7470 / 7977 | 93.64% | 85% |
| branches | 5506 / 6203 | 88.76% | 85% |
| functions | 1242 / 1310 | 94.8% | 85% |
| lines | 7085 / 7432 | 95.33% | 85% |

JUnit SHA-256: `1352d6c7bf6c1798951f953620864e0b49b825390e71b1f34d64265b70851649`.
Coverage-map SHA-256: `04aff4f58fb4f7303f816e3b473f07110f682170c6de391f3dd930f446546520`.

The raw Jest and style logs retain the warnings from this run. The independent cycle check passed against the recorded baseline.

### Named family and acceptance accounting

Expected names were freshly enumerated from all thirteen current design Test Strategy rows. Exact case-sensitive source tokens, declared suite scope, current Babel AST suite templates and the actual full-run JUnit determine execution; similar names never substitute. All generated runner variants matched to each named contract passed. Full per-name source occurrences, JUnit case IDs and all 4,345 cases are retained in `scenario_inventory`. These are local execution results; independent semantic review verifies the behavior behind the names.
The four additional T-009 regression cases passed. They cover the final keepalive BAD_REQUEST and TOKEN_ERROR event sequences, with and without a held call. The 265 named design contracts are accounted for separately.
| Family | Executed / expected named contracts | Status |
| --- | --- | --- |
| T-001 | 18 / 18 | passed |
| T-002 | 13 / 13 | passed |
| T-003 | 11 / 11 | passed |
| T-004 | 17 / 17 | passed |
| T-005 | 10 / 10 | passed |
| T-006 | 8 / 8 | passed |
| T-007 | 62 / 62 | passed |
| T-008 | 22 / 22 | passed |
| T-009 | 26 / 26 | passed |
| T-010 | 21 / 21 | passed |
| T-011 | 16 / 16 | passed |
| T-012 | 30 / 30 | passed |
| T-013 | 11 / 11 | passed |

T-009 `terminalStoppedLineWithoutCallReplaced` exists in current source and passed in the full JUnit. T-009 is 26/26.

| Acceptance | Families | Executed / expected | Status |
| --- | --- | --- | --- |
| AC-001 | T-001, T-002 | 31 / 31 | passed |
| AC-002 | T-001, T-007 | 80 / 80 | passed |
| AC-003 | T-002 | 13 / 13 | passed |
| AC-004 | T-003 | 11 / 11 | passed |
| AC-005 | T-003 | 11 / 11 | passed |
| AC-006 | T-004 | 17 / 17 | passed |
| AC-007 | T-005 | 10 / 10 | passed |
| AC-008 | T-006 | 8 / 8 | passed |
| AC-009 | T-007 | 62 / 62 | passed |
| AC-010 | T-007 | 62 / 62 | passed |
| AC-011 | T-007 | 62 / 62 | passed |
| AC-012 | T-007 | 62 / 62 | passed |
| AC-013 | T-008, T-010 | 43 / 43 | passed |
| AC-014 | T-008, T-009 | 48 / 48 | passed |
| AC-015 | T-007, T-009 | 88 / 88 | passed |
| AC-016 | T-010 | 21 / 21 | passed |
| AC-017 | T-011 | 16 / 16 | passed |
| AC-018 | T-012 | 30 / 30 | passed |
| AC-019 | T-004, T-012 | 47 / 47 | passed |
| AC-020 | T-013 | 11 / 11 | passed |

### Exact named contract inventory

- T-001: `authoritativeArrayFirstOnly`, `completeProfileUnaffected`, `eligibilityChangeHookAfterCurrentResult`, `fiveBoundedReads`, `legacyDisabledNotAggregateOmission`, `nextRegisterObservesEntitlementChanges`, `oldOrgHydrationDiscarded`, `oneCyclePerRegister`, `ordinaryReconnectDoesNotReread`, `profileAggregateDependencyOrder`, `profileObservedAggregateFailures`, `profileUserFailureWithFulfilledIndependentReads`, `readerDependencyFailureRetainsUnknown`, `readerRetryClassification`, `silentReloginRejectsWhileHydrationPending`, `terminalReaderAuthIsolation`, `unknownMalformedFirst`, `welcomeIdentityBoundAtHydrationLaunch`.

- T-002: `acceptedHistoryABAAnd129`, `disabledStopsBothTransportsKeepsLine`, `distinctSwitchSupersedes`, `enabledEligibilityEntersDrWithoutOptIn`, `ignoredHydrationSwitchThenOrdinaryReconnectAndMismatch`, `invalidEnvelopeNoSocketAction`, `lateDisabledSubscribeCannotInstall`, `legacyDisabledRecordDoesNotEnterDr`, `nextRegisterEligibilityControlsSwitchEntry`, `rtdPauseCloseBeforeRecovering`, `switchHistoryAndStationSnapshotLifecycle`, `systemRegionSwitchNeverPublicRawEvent`, `unknownHydrationNoReplayOrHistory`.

- T-003: `closeBeforeWelcome`, `freshAttemptOwnsUrl`, `preservesHostAuthentication`, `preservesIntHeaderAndAllowlist`, `primaryWelcomeIdentityFenced`, `rejectsSubscribeFailure`, `subscribe20sWelcome30s`, `supersededHttpOpenWelcomeInert`, `usableSocketRequiresCurrentWelcome`, `welcomeStructureOnlyForPrimaryAndRtd`, `workerAndBlobOwnership`.

- T-004: `afterWelcomeExceptionStopsWithoutReadmission`, `attemptSettledCarriesSafeFailureOnce`, `dr100603015WithFreshJitter`, `drMessagesDoNotArmOrdinaryTimers`, `noDrWatchdogAt50s`, `noOverlapUnderSlowAttempt`, `ordinaryFiveSecondSlots50sWatchdog`, `ordinaryMismatchStopsAndNotifiesOnce`, `ordinaryReconnectDoesNotEnterDrPolicy`, `pauseCancelsAndRequiresExplicitResume`, `recoverRegionResolveRejectContract`, `repeatFinalDelay`, `restoreSocketLossReschedules`, `sameRegistrationResetRestoresOrdinaryRecovery`, `stoppedDriverNeverReopens`, `throwingAttemptSettledCannotChangeRecovery`, `watchdogAbortsSubscribeOpenAndWelcome`.

- T-005: `eachExactMismatch`, `errorReasonFallback`, `excludesOther409StatusAndOperation`, `headerNameCaseInsensitiveValueCaseSensitive`, `normalizationRetainsCompetingCategoryFields`, `ordinaryMismatchSingleReloadSnapshot`, `ordinaryMismatchStopsAndNotifiesOnce`, `registerRejectAndSingleReloadSnapshot`, `trimFirstNonblank`, `unknownHeaderDefeatsBody`.

- T-006: `119999Blocked120000Allowed`, `authenticatedOrgReadAtDecisionTime`, `clockRollbackAndStorageFailureBlocked`, `exactMarkedHelperIsExecuted`, `firstRestartStoredBeforeNavigation`, `obtainingSessionStorageThrowsBlocked`, `perOrgPerTabPersistsAcrossReloadContexts`, `storageMethodsThrowBlocked`.

- T-007: `acceptedSnapshotReconcilesLatestTeamDeviceDn`, `allReloadAllowlistAnd1035Paths`, `authoritativeStateReconciliation`, `availableVoiceGateUnchangedDuringDr`, `backendSessionEffects`, `backendSessionNotificationIdentityAndProvenance`, `backendSessionNotificationsReconcile`, `browserStationPrerequisitesPreserved`, `cancelledBeforeDispatchSendsNoRequest`, `concurrentExplicitStateKeepsPending`, `defaultAuxNotReplayed`, `disconnectEchoAndAuthoritativeChangePredicate`, `distinctStateRequestIdsAcrossPaths`, `dnStationPrerequisitesPreserved`, `drCallingPreserveVersusOrdinaryReplace`, `drDeviceModeChangeRetainsUnusedLine`, `drReadyBeforeLineRegistrationAndTimeout`, `drRestoreDoesNotReread`, `exactDisconnectAutoStateOnly`, `explicitIntentBeforeArmAndDuringFlight`, `explicitWaitsOnlyForDispatchedDrAuto`, `extensionStationPrerequisitesPreserved`, `failedLoginDoesNotPromote`, `failedLogoutPreservesAcceptedStation`, `failedProfileLogoutPreservesAcceptedStation`, `lateFallbackSuccessAfterAbortCannotCompleteManualLogin`, `lateFallbackSuccessAfterTimeoutCannotCompleteManualLogin`, `lateReloadCannotCompleteRetry`, `lateSessionFailureCannotRejectManualLogin`, `localVoiceRaceDiscriminatorPreventsHiddenRetry`, `manualDrBrowserLoginPreservesHealthyLine`, `manualDrLoginReadyMetadata`, `manualLoginFailureStaysManualAndSuccessReady`, `noEarlyReady`, `notificationBeforeHttpUsesSameOperation`, `orderedPolicyCombinedCases`, `ordinaryCorrelatedStateAndSilentReloginComplete`, `ordinaryReloginKeepsTasksAndAuth`, `ordinaryReloginSupersedesDrAutoWithoutExplicitIntent`, `post1035ReloadArmsAutoAvailableFromOwnResult`, `priorActiveWithoutUsableSnapshot`, `publicStationLoginRejectedDuringAutomaticRestore`, `readyCarriesInitialAutoOutcomeBeforeDispatch`, `recoveryFailureCategoryPrecedence`, `registerReloginUsesNonExplicitSource`, `registerRestoredCountsActive`, `registerRestoredSnapshotEnablesFallback`, `reloadSnapshotMapping`, `remoteLogoutPreventsAutomaticRestore`, `sameSocketAndReplacementKeepStateCorrelation`, `sessionAttemptIdsAreUnique`, `sessionTrackingProvenanceSurvivesSettlement`, `socketLossPreservesGenerationRestoreBudget`, `stateAndSessionRequireNestedTracking`, `stateNotificationSingleApplierBeforeGenericEmit`, `stateRequestIdRequired`, `stationLoginSettlementBeforeAncillaryAwait`, `terminalAuthAcrossRestoreStages`, `timeoutLateReplyCannotCompleteExplicit`, `timeoutLateReplyWithoutNewerStateRetainsFailed`, `voiceDeferredReadyAndSingleDispatch`, `wxAppEffectsAfterStationRestore`.

- T-008: `aliasCleanupCannotDeleteReplacement`, `aqmMessageDiagnosticsCannotBlockSettlement`, `correlationDoesNotBypassDuplicateAdmission`, `entryInterruptBefore100sWait`, `gateKindAndSessionOwnerMatrix`, `interruptedAndStalePublicMutatorsAreInert`, `interruptedTaskOperationObservesLateRejectionAndReleasesScope`, `interruptionErrorsAreIndependent`, `lifecycleCallerCatchPreservesIdentityAndReason`, `lifecycleErrorDataReasonPreserved`, `manualLoginAndGettersAllowed`, `noSecond20sTimeoutSettlement`, `ordinaryRequestAndTaskOwnershipUnchanged`, `postCleanupHydrateCreatesFreshTaskRetainedStaysStale`, `postWelcomeStaleTaskDisabledControlsNoEnd`, `publicSessionAdmissionByRecoveryPhase`, `recoveringCommandsBlockedBeforeIo`, `regionalCleanupReusesExistingOwners`, `setAgentStateAdmissionAdvancesIntent`, `staleControlsPreservePreStopSnapshot`, `timeoutDisabledAliasDisplacementInterrupted`, `timeoutDisabledDisplacedAbortKeepsReplacement`.

- T-009: `abortedEnsureCallerDoesNotCancelSharedAttempt`, `absentLineEstablishesOnce`, `allEnsureCallersDetachedAttemptObserved`, `autoWrapupAfterInterruptionNeverRearmsOrRejectsUnhandled`, `availableVoiceGateUnchangedDuringDr`, `chainedWxAppContinuationGuarded`, `connectingAndReconnectingDelegate`, `drCallingPreserveVersusOrdinaryReplace`, `drDeviceModeChangeRetainsUnusedLine`, `drReadyBeforeLineRegistrationAndTimeout`, `duplicateEnsureAndCancelledCreate`, `ensureAcknowledgesBeforeRegistrationSettles`, `ensureLineStatusOwnershipMatrix`, `existingOwnedTracksDisposed`, `healthyLineRetainedWithSingleListeners`, `hostTracksUntouched`, `lateMediaDuringWaitAndAfterWipeStopsTracks`, `manualDrBrowserLoginPreservesHealthyLine`, `noAnswerEndOrHealthyDeregister`, `notRequiredRetainsOwnedLine`, `preserveEnsureDisabledLine`, `registeredLineWithMobiusDisconnectedRetained`, `supersededRegistrationDisposesOnlyOwnedCandidate`, `terminalStoppedLineWithoutCallReplaced`, `unregisteredActiveCallDefersToCallingOwner`, `unregisteredKeepaliveRetryDelegates`.

- T-010: `allFiveFeatureConditions`, `deregisterCancelsPendingRtdAdmission`, `freshRtdAdmissionAfterSession`, `lateHttpCannotRearmClearedRequest`, `manualLoginFailureKeepsRtdClosedAndRetryResumes`, `manualPriorStationDefers`, `noPriorStationResume`, `nonTaskRtdOperationsUseCurrentOwner`, `oldAckFailureCannotRemoveSameKeyReplacement`, `oldRtdCannotResolveNewSummary`, `repeatedRtdPauseResumeKeepsSingleMessageListener`, `restoredTaskSummaryCapabilitiesRequireFreshEnablement`, `resumeRtdWithActiveEpochIsNoOp`, `rtdFailureLeavesCoreReady`, `rtdPauseCloseBeforeRecovering`, `rtdRequestSignalOwnsCancellation`, `staleRtdTranscriptsAndSuggestionsDropped`, `staleRtdWellnessAndEnablementDuringPauseDropped`, `staleTimeoutAndAbortCannotRemoveSameKeyReplacement`, `storedRtdCallbackUsesContactCenterEpoch`, `supersedingSwitchCancelsPendingRtdAdmission`.

- T-011: `all13ExactLabels`, `completeSnapshotEachAutoOutcome`, `enabledOnlyLimitedService`, `firstStationLoginReady`, `hydrationCompletionRepublishesHomeRegionAndLimitedService`, `hydrationRepublishesExistingSnapshotOnly`, `logoutThenReloginEmitsReadyAgain`, `manualDrLoginReadyMetadata`, `normalizedHomeServingComparison`, `primaryPlacementAccessorAndReset`, `readyCarriesInitialAutoOutcomeBeforeDispatch`, `registerRestoredSessionReady`, `rtdNeverRecordsPlacement`, `socketOnlyNeverReady`, `teardownCancelsThenResetsSnapshot`, `unknownMetadataClearsPriorValues`.

- T-012: `affectedPublicForwardingContainsThrow`, `attemptFailureDiagnosticsPreserveClassification`, `blanketMultiLoginNoReconnect`, `cancelledObserverCannotResumeSupersededRecovery`, `everyTerminationDuringEveryAwait`, `lateHttpWelcomeReloadMedia`, `messageFanoutContinuesAfterThrow`, `multiLoginWellnessSessionMatch`, `multiLoginWithoutNestedTypeCharacterization`, `observerReentrantLogoutDeregister`, `offline4295xxPacing`, `primaryMultiLoginCancelsBeforeForwarding`, `reRegisterListenerCardinality`, `readerVsPrimaryVsRtdAuthBoundaries`, `realRecoveryWiringUsesActualCollaborators`, `regionDiagnosticSupersessionOwnsElapsed`, `registrationTerminationClearsHistoryAndSnapshot`, `rtdMultiLoginStaysClosedWithoutPrimaryTermination`, `sharedRegistrationGenerationFencesWellnessAndRecovery`, `stationLogoutCancellationSnapshotPolicy`, `stationLogoutDuringDrKeepsUsablePrimary`, `stationLogoutDuringDrWithoutPrimaryRejectsImmediately`, `stationLogoutKeepsHistoryClearsSnapshot`, `stationLogoutOrdinaryReconnectPreserved`, `targetedMultiLogin`, `terminalCancellationUsesLastReadyOrNone`, `throwingObserverLoggerMetricsCannotStopCleanupOrSuccess`, `throwingObserverSkipsLaterListeners`, `throwingWelcomeAndReloadNotificationStillReady`, `welcomeSettlesDespiteThrowingMessageDiagnostics`.

- T-013: `additiveRecoveryExportsAndTypedConsumer`, `aqmTimeoutAndInterruptDiagnosticsRedacted`, `concurrentExplicitStateKeepsPending`, `diagnosticPayloadAllowlist`, `docContractLinksAndExactHostExample`, `lifecycleCallerCatchPreservesIdentityAndReason`, `noSecretsInAllAffectedDiagnostics`, `oldPublicSignaturesVoiceControls`, `plainErrorCatalogRoundTrip`, `publicCcEventsKeysUnchanged`, `systemRegionSwitchNeverPublicRawEvent`.

## Independent spec review

A focused read-only Claude Code review covered the modified WebCallingService, its regression tests and the refreshed local evidence. It rechecked the affected findings, carried the earlier independent review for hash-matched inputs and passed all 13 MR-11 checks. The verdict is **pass-with-warnings**, with zero blocking findings. The validator was claude-sonnet-5-5 in session d3b64ec8-3ce9-48e1-a9c3-f0f87ac4293e from 2026-11-23T14:54:56.314267+00:00 to 2026-11-23T14:56:11.998893+00:00.

The retained trace is .matrix/validation-runs/rf_825b48075e300a6057be48c7/validator.jsonl, with SHA-256 071bcfa04ffdba76a711beb791e7a73dc6f892df7e6008c6810140cc8f4d41f9. The receipt records 13 nonblocking findings, including two draft evidence observations resolved by the recorded Calling-context and report checks. All five canonical conformance checks passed.

The previous full independent review remains in the recovery archive. Its unchanged evidence carries forward through the recorded file hashes. The original failed packet below and the earlier unsuccessful authentication attempt remain historical.

### Historical fix-packet acceptance before MR-11 recovery

This subsection records the superseded November 23 review-fix attempt. Its acceptance command ran from 06:33:45 to 06:35:45 UTC. The MR-10 portion passed 4,341 tests across 43 suites with zero failures or skips. It also passed the build, 85% Babel coverage thresholds, style, import-cycle, and declaration checks. The packet exited 1 because MR-11 independent validation was pending at the time. Its standalone MR-11 check also exited 1 before the recovery review.

The original JUnit SHA-256 is `5bb9daf72d862c4a5448e7b996e034552e8a2ad2a4161bec664548ada24f0263`. The retained run accounted for 265/265 exact named contracts, including 26/26 for T-009. The consolidated record retains the original logs and digests. The later completed MR-11 review above supplies the current canonical verdict.

## Release evidence

Local product verification is complete. Release and rollout remain blocked on separately owned deployed evidence. Local client fixtures, JUnit and this review do not establish deployed compatibility or active-call audio continuity.

| Evidence | Owner | Status |
| --- | --- | --- |
| Authoritative positive organization settings fixture | Routing platform API owner | not-executed |
| Independent-reader deployed isolation | QA and Routing platform | not-executed |
| Maintainer compatibility review | SDK maintainer | not-executed |
| REL-AQM-TRACKING-ECHO | SDK maintainer and Routing platform API owner | not-executed |
| AC-021 | QA and platform owners | not-executed |

AC-021 remains **not-executed**. Its four prerequisites and six DN/extension/browser × failover/failback records are retained under `release_evidence`; none has supplied live evidence. Required captures include authoritative organization settings, admission placement, station result, new-call results and supported RTD/voice evidence with timestamps and deployed versions.

REL-AQM-TRACKING-ECHO requires sanctioned deployed full-ID request/success and notification-failure pairs for stateChange, stationLogin and reload. Missing/negative evidence blocks this candidate release. The SDK maintainer and Routing platform API owner own the compatibility decision; QA/platform operators produce captures. Existing released SDK delivery remains in use.

The authoritative fixture, deployed independent-reader isolation and maintainer compatibility review are also not executed. See the exact owners/reasons/evidence_refs in `release_evidence` and the checklist in [getting-started.md](getting-started.md#multi-region-recovery-rollout-and-rollback).

Unmet conditions: unmodified default-v8 baseline verification (not executed); all five deployed/live release items (not executed). No earlier missing-T-009 condition remains.
