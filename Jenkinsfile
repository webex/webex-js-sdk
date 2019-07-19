def IS_VALIDATED_MERGE_BUILD = false
skipTests = false

def warn = { msg ->
  if (!currentBuild.description) {
    currentBuild.description += ''
  }
  else if (currentBuild.description.substring(currentBuild.description.length() - 1) != '\n') {
    currentBuild.description += '<br />\n'
  }
  currentBuild.description += "warning: ${msg}<br />\n"
}

def cleanup = { ->
  // Reminder: cleanup can't be a stage because it will cause Jenkins to drop
  // discard the stage view for any build that happened before a failed build
  try {
    archive 'reports/**/*'
    archive 'html-report/**/*'
  }
  catch(err) {
    // ignore; not sure if this'll throw if no reports have been generated
  }
  sh 'rm -f .env'

  try {
    if (fileExists('./reports/timings')) {
      currentBuild.description += readFile('./reports/timings')
    }
  }
  catch(err) {
    warn('could not read timings file');
  }

  if (IS_VALIDATED_MERGE_BUILD) {
    if (currentBuild.result != 'SUCCESS') {
      withCredentials([usernamePassword(
        credentialsId: '386d3445-b855-40e4-999a-dc5801336a69',
        passwordVariable: 'GAUNTLET_PASSWORD',
        usernameVariable: 'GAUNTLET_USERNAME'
      )]) {
        sh "curl -i --user ${GAUNTLET_USERNAME}:${GAUNTLET_PASSWORD} -X PUT 'https://gauntlet.wbx2.com/api/queues/spark-js-sdk/master?componentTestStatus=failure&commitId=${GIT_COMMIT}'"
      }
    }
  }
}

def generateDockerEnv = { ->
  def dockerEnv = ""

  // Common (to gating jobs) environment-specific variables
  if (env.ACL_SERVICE_URL != null) {
    dockerEnv+="ACL_SERVICE_URL=${env.ACL_SERVICE_URL}\n"
  }
  if (env.ATLAS_SERVICE_URL != null) {
    dockerEnv+="ATLAS_SERVICE_URL=${env.ATLAS_SERVICE_URL}\n"
  }
  if (env.COMMON_IDENTITY_OAUTH_SERVICE_URL != null) {
    dockerEnv+="COMMON_IDENTITY_OAUTH_SERVICE_URL=${env.COMMON_IDENTITY_OAUTH_SERVICE_URL}\n"
  }
  if (env.CONVERSATION_SERVICE != null) {
    dockerEnv+="CONVERSATION_SERVICE=${env.CONVERSATION_SERVICE}\n"
  }
  if (env.ENCRYPTION_SERVICE_URL != null) {
    dockerEnv+="ENCRYPTION_SERVICE_URL=${env.ENCRYPTION_SERVICE_URL}\n"
  }
  if (env.HYDRA_SERVICE_URL != null) {
    dockerEnv+="HYDRA_SERVICE_URL=${env.HYDRA_SERVICE_URL}\n"
  }
  if (env.IDBROKER_BASE_URL != null) {
    dockerEnv+="IDBROKER_BASE_URL=${env.IDBROKER_BASE_URL}\n"
  }
  if (env.IDENTITY_BASE_URL != null) {
    dockerEnv+="IDENTITY_BASE_URL=${env.IDENTITY_BASE_URL}\n"
  }
  if (env.WDM_SERVICE_URL != null) {
    dockerEnv+="WDM_SERVICE_URL=${env.WDM_SERVICE_URL}\n"
  }
  if (env.WHISTLER_API_SERVICE_URL != null) {
    dockerEnv+="WHISTLER_API_SERVICE_URL=${env.WHISTLER_API_SERVICE_URL}\n"
  }

  // Other environment-specific variables
  if (env.DEVICE_REGISTRATION_URL != null) {
    dockerEnv+="DEVICE_REGISTRATION_URL=${env.DEVICE_REGISTRATION_URL}\n"
  }

  // Build-specific variables
  if (env.BUILD_NUMBER != null) {
    dockerEnv+="BUILD_NUMBER=${env.BUILD_NUMBER}\n"
  }
  if (env.COVERAGE != null) {
    dockerEnv+="COVERAGE=${env.COVERAGE}\n"
  }
  if (env.ENABLE_NETWORK_LOGGING != null) {
    dockerEnv+="ENABLE_NETWORK_LOGGING=${env.ENABLE_NETWORK_LOGGING}\n"
  }
  if (env.ENABLE_VERBOSE_NETWORK_LOGGING != null) {
    dockerEnv+="ENABLE_VERBOSE_NETWORK_LOGGING=${env.ENABLE_VERBOSE_NETWORK_LOGGING}\n"
  }
  if (env.GIT_COMMIT != null) {
    dockerEnv+="GIT_COMMIT=${env.GIT_COMMIT}\n"
  }
  if (env.PIPELINE != null) {
    dockerEnv+="PIPELINE=${env.PIPELINE}\n"
  }
  if (env.SAUCE_IS_DOWN != null) {
    dockerEnv+="SAUCE_IS_DOWN=${env.SAUCE_IS_DOWN}\n"
  }
  if (env.SDK_BUILD_DEBUG != null) {
    dockerEnv+="SDK_BUILD_DEBUG=${env.SDK_BUILD_DEBUG}\n"
  }
  if (env.SKIP_FLAKY_TESTS != null) {
    dockerEnv+="SKIP_FLAKY_TESTS=${env.SKIP_FLAKY_TESTS}\n"
  }
  if (env.WORKSPACE != null) {
    dockerEnv+="WORKSPACE=${env.WORKSPACE}\n"
  }

  writeFile file: DOCKER_ENV_FILE, text: dockerEnv
}

def generateSecretsFile = { ->
  withCredentials([
    string(credentialsId: '9f44ab21-7e83-480d-8fb3-e6495bf7e9f3', variable: 'WEBEX_CLIENT_SECRET'),
    string(credentialsId: 'CISCOSPARK_APPID_ORGID_INT', variable: 'WEBEX_APPID_ORGID'),
    string(credentialsId: 'CISCOSPARK_APPID_SECRET_INT', variable: 'WEBEX_APPID_SECRET'),
    usernamePassword(credentialsId: 'SAUCE_LABS_VALIDATED_MERGE_CREDENTIALS', passwordVariable: 'SAUCE_ACCESS_KEY', usernameVariable: 'SAUCE_USERNAME'),
    string(credentialsId: 'ddfd04fb-e00a-4df0-9250-9a7cb37bce0e', variable: 'COMMON_IDENTITY_CLIENT_SECRET'),
    string(credentialsId: 'JS_SDK_NPM_TOKEN', variable: 'JS_SDK_NPM_TOKEN'),
    string(credentialsId: 'JS_SDK_NPM_PUBLISH_TOKEN', variable: 'JS_SDK_NPM_PUBLISH_TOKEN')
  ]) {
    def secrets = ""
    secrets += "COMMON_IDENTITY_CLIENT_SECRET=${COMMON_IDENTITY_CLIENT_SECRET}\n"
    secrets += "WEBEX_APPID_ORGID=${WEBEX_APPID_ORGID}\n"
    secrets += "WEBEX_APPID_SECRET=${WEBEX_APPID_SECRET}\n"
    secrets += "WEBEX_CLIENT_SECRET=${WEBEX_CLIENT_SECRET}\n"
    secrets += "SAUCE_USERNAME=${SAUCE_USERNAME}\n"
    secrets += "SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}\n"
    secrets += "JS_SDK_NPM_TOKEN=${JS_SDK_NPM_TOKEN}\n"
    secrets += "JS_SDK_NPM_PUBLISH_TOKEN=${JS_SDK_NPM_PUBLISH_TOKEN}"
    writeFile file: ENV_FILE, text: secrets
  }
}

ansiColor('xterm') {
  timestamps {
    timeout(120) {

      node("SPARK_JS_SDK_VALIDATING") {

        // Prepare ////////////////////////////////////////////////////////////////////////////////////////////////////

        try {
          // Set the description to blank so we can use +=
          currentBuild.description = ''

          env.CONCURRENCY = 4
          env.ENABLE_VERBOSE_NETWORK_LOGGING = true
          env.SDK_ROOT_DIR=pwd

          if (JOB_NAME.toLowerCase().contains('validated-merge')) {
            IS_VALIDATED_MERGE_BUILD = true
          }

          if (IS_VALIDATED_MERGE_BUILD) {
            env.COVERAGE = true
          }
          else {
            env.PIPELINE = true
            env.SKIP_FLAKY_TESTS = true
          }

          DOCKER_IMAGE_NAME = "${JOB_NAME}-${BUILD_NUMBER}-builder"
          def image

          // Kill any zombie containers from previous jobs
          try {
            sh "docker kill \$(docker ps | grep ${JOB_NAME} | grep -v '${BUILD_NUMBER}-builder' | awk '{print \$1}')"
          }
          catch(err) {
            try {
              echo "Failed to kill docker containers from previous builds. this *should* mean their weren't any"
              echo err.toString()
              echo 'The following docker containers are running on this host'
              def containers = sh script: 'docker ps', returnStdout: true
              echo containers.toString()
              echo 'The following build containers are running on this host'
              def builders = sh script: "docker ps | grep ${JOB_NAME}", returnStdout: true
              echo builders.toString()
              echo 'The following build containers (excluding this build) are running on this host'
              def filtered = sh script: "docker ps | grep ${JOB_NAME} | grep -v '${BUILD_NUMBER}-builder'", returnStdout: true
              echo filtered.toString()
              echo 'The following build container ids (excluding this build) are running on this host'
              def ids = sh script: "docker ps | grep ${JOB_NAME} | grep -v '${BUILD_NUMBER}-builder' | awk '{print \$1}'", returnStdout: true
              echo ids.toString()
            }
            catch (err2) {
              echo 'This failure probably means there were no docker containers to kill'
              echo err2.toString()
            }
          }

          DOCKER_ENV_FILE = "${env.WORKSPACE}/docker-env"
          ENV_FILE = "${env.WORKSPACE}/.env"

          DOCKER_RUN_OPTS = '-e JENKINS=true'
          DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} --env-file=${DOCKER_ENV_FILE}"
          DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} --env-file=${ENV_FILE}"
          DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} -e NPM_CONFIG_CACHE=${env.WORKSPACE}/.npm"
          DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} --volumes-from=\$(hostname)"
          DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} --user=\$(id -u):\$(id -g)"
          // DOCKER_RUN_OPTS has some values in it that we want to evaluate on
          // the node, but image.inside doesn't do subshell execution. We'll use
          // echo to evaluate once on the node and store the values.
          DOCKER_RUN_OPTS = sh script: "echo -n ${DOCKER_RUN_OPTS}", returnStdout: true
          // image.inside uses the -d flag, so we can only use --rm for
          // bash-started containers
          env.DOCKER_RUN_OPTS = "${DOCKER_RUN_OPTS} --rm ${DOCKER_IMAGE_NAME}"


          // Define Stages ////////////////////////////////////////////////////////////////////////////////////////////


          stage('checkout') {
            checkout scm
            // Copy the global git user details into the local repo so that the
            // docker containers have access to it.
            sh 'git config user.email spark-js-sdk.gen@cisco.com'
            sh 'git config user.name Jenkins'
            if (IS_VALIDATED_MERGE_BUILD) {
              try {
                pusher = sh script: 'git show  --quiet --format=%ae HEAD', returnStdout: true
                currentBuild.description += "Validating push from ${pusher} <br />"
              }
              catch (err) {
                currentBuild.description += 'Could not determine pusher <br />';
              }

              sshagent(['707208aa-a797-4ee4-990d-7f61479b35b5']) {
                // return the exit code because we don't care about failures
                sh script: 'git remote add upstream git@github.com:webex/webex-js-sdk.git', returnStatus: true
                // Make sure local tags don't include failed releases
                sh 'git tag | xargs git tag -d'
                sh 'git gc'

                sh 'git fetch upstream --tags'
              }

              changedFiles = sh script: 'git diff --name-only upstream/master..$(git merge-base HEAD upstream/master)', returnStdout: true
              if (changedFiles.contains('Jenkinsfile')) {
                currentBuild.description += "Jenkinsfile has been updated in master. Please rebase and push again. <br />"
                error(currentBuild.description)
              }

              sh 'git checkout upstream/master'
              try {
                sh "git merge --ff ${GIT_COMMIT}"
              }
              catch (err) {
                currentBuild.description += 'not possible to fast forward <br />'
                throw err;
              }
            }

            // Define test URLs for the integration (test) environment.
            env.ACL_SERVICE_URL='https://acl-intb.ciscospark.com/acl/api/v1'
            env.ATLAS_SERVICE_URL='https://atlas-intb.ciscospark.com/admin/api/v1'
            env.CONVERSATION_SERVICE='https://conversation-intb.ciscospark.com/conversation/api/v1'
            env.ENCRYPTION_SERVICE_URL='https://encryption-intb.ciscospark.com/encryption/api/v1'
            env.HYDRA_SERVICE_URL='https://apialpha.ciscospark.com/v1/'
            env.IDBROKER_BASE_URL='https://idbrokerbts.webex.com'
            env.IDENTITY_BASE_URL='https://identitybts.webex.com'
            env.WDM_SERVICE_URL='https://wdm-intb.ciscospark.com/wdm/api/v1'
            env.WHISTLER_API_SERVICE_URL='https://whistler.onint.ciscospark.com/api/v1'

            // Skip flaky tests by default.
            env.SKIP_FLAKY_TESTS=true

            generateDockerEnv()
            generateSecretsFile()
          }

          stage('docker build') {
            sh 'echo "RUN groupadd -g $(id -g) jenkins" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN useradd -u $(id -u) -g $(id -g) -m jenkins" >> ./docker/builder/Dockerfile'
            sh 'echo "USER $(id -u)" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN echo $HOME" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN ls -l $HOME" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN mkdir -p $HOME" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN mkdir -p $HOME/.ssh" >> ./docker/builder/Dockerfile'
            sh 'echo "RUN ssh-keyscan -H github.com >> $HOME/.ssh/known_hosts" >> ./docker/builder/Dockerfile'
            sh "echo 'WORKDIR ${env.WORKSPACE}' >> ./docker/builder/Dockerfile"

            retry(3) {
              dir('docker/builder') {
                image = docker.build(DOCKER_IMAGE_NAME)
              }
              // Reset the Dockerfile to make sure we don't accidentally commit it
              // later
              sh "git checkout ./docker/builder/Dockerfile"
            }
          }

          stage('install') {
            image.inside(DOCKER_RUN_OPTS) {
              // Remove the old symlink that tends to screw up installing the
              // new package
              sh 'rm -f ./node_modules/@webex/eslint-config'
              sh 'echo \'//registry.npmjs.org/:_authToken=${JS_SDK_NPM_TOKEN}\' > $HOME/.npmrc'
              sh 'npm ci'
            }
          }

          stage('clean') {
            sh 'git clean -df'
            sh 'rm -rf "packages/node_modules/*/browsers.processed.js"'
            sh 'rm -rf "packages/node_modules/@ciscospark/*/browsers.processed.js"'
            sh 'rm -rf "packages/node_modules/@webex/*/browsers.processed.js"'
            sh 'rm -rf ".sauce/*/sc.*"'
            sh 'rm -rf ".sauce/*/sauce_connect*log"'
            sh 'rm -rf reports'
            sh 'rm -rf .tmp'
            sh 'rm -rf .tmp_uploads'
            sh 'mkdir -p reports/coverage'
            sh 'mkdir -p reports/coverage-final'
            sh 'mkdir -p reports/junit'
            sh 'mkdir -p reports/logs'
            sh 'mkdir -p reports/sauce'
            sh 'mkdir -p reports/style'
            sh 'chmod -R ugo+w reports'
          }

          if (IS_VALIDATED_MERGE_BUILD) {
            stage('static analysis') {
              // running eslint on a per-package basis is really slow, so we're
              // giving up a little bit of per-package static analysis config by
              // running eslint once across all package.
              image.inside(DOCKER_RUN_OPTS) {
                sh script: "npm run lint:ci", returnStatus: true
                if (!fileExists("./reports/style/eslint.xml")) {
                  error('Static Analysis did not produce eslint.xml')
                }
              }
              step([$class: 'CheckStylePublisher',
                canComputeNew: false,
                defaultEncoding: '',
                healthy: '',
                pattern: 'reports/style/**/*.xml',
                thresholdLimit: 'high',
                unHealthy: '',
                unstableTotalHigh: '0'
              ])
            }
          }

          if (!IS_VALIDATED_MERGE_BUILD || currentBuild.result == 'SUCCESS') {
            stage('build') {
              image.inside(DOCKER_RUN_OPTS) {
                sh 'npm run build'
                // Generate dependencies to confirm package.json contains all
                // needed dependencies
                sh 'npm run deps:generate'
                // Now that we've confirmed deps:generate works, undo the
                // generated deps. They'll be regenerated after we set new
                // package versions.
                sh 'git checkout ./packages'
              }
            }

            stage('test') {
              image.inside(DOCKER_RUN_OPTS) {
                def action = sh script: 'npm run --silent tooling -- check-testable', returnStdout: true

                if (action.contains('skip')) {
                  skipTests = true
                  warn('bypassing tests (tests explicitly skipped or changes do not require testing)');
                }
              }

              echo 'copying coverage files'
              step([
                $class: 'CopyArtifact',
                projectName: 'spark-js-sdk--validated-merge--pipeline2',
                filter: 'reports/coverage/**',
                excludes: '**/lcov.info',
                fingerprintArtifacts: true,
                optional: true
              ])

              if (!skipTests) {
                timeout(90) {
                  echo 'running tests'
                  def exitCode = sh script: "./tooling/test.sh", returnStatus: true

                  junit 'reports/junit/**/*.xml'

                  if (currentBuild.result == 'SUCCESS' && exitCode != 0) {
                    error('test.sh exited with non-zero error code, but did not produce junit output to that effect')
                  }

                  if (currentBuild.result == 'UNSTABLE' && !IS_VALIDATED_MERGE_BUILD) {
                    error('Failing build in order to propagate UNSTABLE to parent build')
                  }
                }
              }
            }
          }

          if (env.COVERAGE && currentBuild.result == 'SUCCESS') {
            stage('process coverage') {
              if (!skipTests) {
                archive 'reports/cobertura.xml'

                // At the time this script was written, the cobertura plugin didn't
                // support pipelines, so we need to use a freeform job to process
                // code coverage
                coverageBuild = build job: 'spark-js-sdk--validated-merge--coverage-processor', propagate: false
                if (coverageBuild.result != 'SUCCESS') {
                  currentBuild.result = coverageBuild.result
                  if (coverageBuild.result == 'UNSTABLE') {
                    currentBuild.description += coverageBuild.description + '<br />'
                  }
                  else if (coverageBuild.result == 'FAILURE') {
                    currentBuild.description += "Coverage job failed. See the logged build url for more details. <br />"
                  }
                }
              }
            }

            def version = ''
            if (IS_VALIDATED_MERGE_BUILD && currentBuild.result == 'SUCCESS') {
              stage('build for release') {
                env.NODE_ENV = ''
                image.inside(DOCKER_RUN_OPTS) {
                  echo 'getting latest published versions from npm; this might take a moment'
                  version = sh script: 'npm run --silent get-next-version', returnStdout: true
                  version = version.trim()
                  echo "next version is ${version}"
                  sh 'npm run build'
                  // add version number here too as a just in case
                  sh "npm run build:script -- --versionNumber=${version}"
                  // build docs here since they need to be added with `git add`
                  sh 'npm run build:docs'

                  sh "npm run tooling -- version set ${version} --last-log"

                  sh 'git add packages/node_modules/*/package.json packages/node_modules/@ciscospark/*/README.md packages/node_modules/@webex/*/package.json docs/ packages/node_modules/webex/umd/*.js'

                  def commitResult = sh script: "git commit --no-verify -m v${version}", returnStatus: true
                  // commit will fail if we had no files to commit
                  if (commitResult.toString() == '0') {
                    sh "git tag 'v${version}'"
                  }

                  sh "npm run deps:generate"

                  // Rebuild with correct version number
                  sh 'npm run build'
                  sh "npm run build:script -- --versionNumber=${version}"
                  sh 'npm run build:docs'
                }

                sh 'git rev-parse HEAD > .promotion-sha'
                archive '.promotion-sha'
                sh 'rm .promotion-sha'
              }
            }

            if (IS_VALIDATED_MERGE_BUILD && currentBuild.result == 'SUCCESS') {
              stage('check #no-push') {
                try {
                  noPushCount = sh script: 'git log upstream/master.. | grep -c "#no-push"', returnStdout: true
                  if (noPushCount != '0') {
                    currentBuild.result = 'ABORTED'
                    currentBuild.description += 'Aborted: git history includes #no-push <br />'
                  }
                }
                catch (err) {
                  // ignore. turns out that when there are zero #no-push
                  // commits, sh throws. This should be improved at some point,
                  // but gets the job done for now
                }
              }
            }

            if (IS_VALIDATED_MERGE_BUILD && currentBuild.result == 'SUCCESS') {
              stage('publish to github') {
                // Note: if this stage fails, we should consider the build a failure
                sshagent(['707208aa-a797-4ee4-990d-7f61479b35b5']) {
                  sh "git push upstream HEAD:master"
                }
              }

              stage('mark as gating') {
                markAsGatingJob = build job: 'spark-js-sdk--mark-as-gating', propagate: false
                if (markAsGatingJob.result != 'SUCCESS') {
                  warn('failed to mark as gating')
                }
              }

              stage('publish to npm') {
                try {
                  image.inside(DOCKER_RUN_OPTS) {
                    sh 'echo \'//registry.npmjs.org/:_authToken=${JS_SDK_NPM_PUBLISH_TOKEN}\' > $HOME/.npmrc'
                    echo ''
                    echo ''
                    echo ''
                    echo 'Reminder: E403 errors below are normal. They occur for any package that has no updates to publish'
                    echo ''
                    echo ''
                    echo ''
                    sh 'npm run tooling -- exec -- bash -c \'npm publish --access public || true\''
                    echo ''
                    echo ''
                    echo ''
                    echo 'Reminder: E403 errors above are normal. They occur for any package that has no updates to publish'
                    echo ''
                    echo ''
                    echo ''
                  }
                  if ("${version}" == '') {
                    warn('could not determine tag name to push to github.com')
                  }
                  else {
                    sshagent(['707208aa-a797-4ee4-990d-7f61479b35b5']) {
                      try {
                        sh "git push upstream v${version}:v${version}"
                      }
                      catch (err) {
                        // ignore - we don't always have a tag to push
                      }
                    }
                  }

                }
                catch (error) {
                  warn("failed to publish to npm ${error.toString()}")
                }
              }
            }
          }

          cleanup(IS_VALIDATED_MERGE_BUILD)
        }
        catch(error) {
          echo "An error occurred. The following containers are still running on this host"
          sh 'docker ps --format "table {{.ID}}\t{{.Names}}"'

          // Read junit again because we may have gotten here due to a timeout
          try {
            sh script: 'tooling/xunit-strip-logs.sh', returnStatus: true;
            junit 'reports/junit/**/*.xml'
          }
          catch(err) {
            // ignore
          }

          // If we made it to the point, we need to make sure the build is
          // definitely a failure in order to invoke the Gauntlet callback
          if (currentBuild.result != 'UNSTABLE') {
            currentBuild.result = 'FAILURE'
          }

          echo error.toString();
          cleanup(IS_VALIDATED_MERGE_BUILD)
          throw error
        }
      }
    }
  }
}
