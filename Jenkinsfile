def IS_VALIDATED_MERGE_BUILD = false
def HAS_LEGACY_CHANGES

def warn = { msg ->
  if (!currentBuild.description) {
    currentBuild.description += ''
  }
  else if (currentBuild.description.substring(currentBuild.description.length() - 1) != '\n') {
    currentBuild.description += '<br/>\n'
  }
  currentBuild.description += "warning: ${msg}<br/>\n"
}

def cleanup = { ->
  // Reminder: cleanup can't be a stage because it will cause Jenkins to drop
  // discard the stage view for any build that happened before a failed build
  archive 'reports/**/*'
  sh 'rm -f .env'

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
  if (env.ATLAS_SERVICE_URL != null) {
    dockerEnv+="ATLAS_SERVICE_URL=${env.ATLAS_SERVICE_URL}\n"
  }
  if (env.BUILD_NUMBER != null) {
    dockerEnv+="BUILD_NUMBER=${env.BUILD_NUMBER}\n"
  }
  if (env.CISCOSPARK_APPID_ORGID != null) {
    dockerEnv+="CISCOSPARK_APPID_ORGID=${env.CISCOSPARK_APPID_ORGID}\n"
  }
  if (env.CONVERSATION_SERVICE != null) {
    dockerEnv+="CONVERSATION_SERVICE=${env.CONVERSATION_SERVICE}\n"
  }
  if (env.COMMON_IDENTITY_OAUTH_SERVICE_URL != null) {
    dockerEnv+="COMMON_IDENTITY_OAUTH_SERVICE_URL=${env.COMMON_IDENTITY_OAUTH_SERVICE_URL}\n"
  }
  if (env.COVERAGE != null) {
    dockerEnv+="COVERAGE=${env.COVERAGE}\n"
  }
  if (env.DEVICE_REGISTRATION_URL != null) {
    dockerEnv+="DEVICE_REGISTRATION_URL=${env.DEVICE_REGISTRATION_URL}\n"
  }
  if (env.ENABLE_NETWORK_LOGGING != null) {
    dockerEnv+="ENABLE_NETWORK_LOGGING=${env.ENABLE_NETWORK_LOGGING}\n"
  }
  if (env.ENABLE_VERBOSE_NETWORK_LOGGING != null) {
    dockerEnv+="ENABLE_VERBOSE_NETWORK_LOGGING=${env.ENABLE_VERBOSE_NETWORK_LOGGING}\n"
  }
  if (env.HYDRA_SERVICE_URL != null) {
    dockerEnv+="HYDRA_SERVICE_URL=${env.HYDRA_SERVICE_URL}\n"
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
  if (env.WDM_SERVICE_URL != null) {
    dockerEnv+="WDM_SERVICE_URL=${env.WDM_SERVICE_URL}\n"
  }
  if (env.WORKSPACE != null) {
    dockerEnv+="WORKSPACE=${env.WORKSPACE}\n"
  }
  if (env.MESSAGE_DEMO_CLIENT_ID != null) {
    dockerEnv+="MESSAGE_DEMO_CLIENT_ID=${env.MESSAGE_DEMO_CLIENT_ID}\n"
  }
  if (env.MESSAGE_DEMO_CLIENT_SECRET != null) {
    dockerEnv+="MESSAGE_DEMO_CLIENT_SECRET=${env.MESSAGE_DEMO_CLIENT_SECRET}\n"
  }
  writeFile file: DOCKER_ENV_FILE, text: dockerEnv
}

def generateSecretsFile = { ->
  withCredentials([
    string(credentialsId: '9f44ab21-7e83-480d-8fb3-e6495bf7e9f3', variable: 'CISCOSPARK_CLIENT_SECRET'),
    string(credentialsId: 'CISCOSPARK_APPID_SECRET', variable: 'CISCOSPARK_APPID_SECRET'),
    usernamePassword(credentialsId: 'SAUCE_LABS_VALIDATED_MERGE_CREDENTIALS', passwordVariable: 'SAUCE_ACCESS_KEY', usernameVariable: 'SAUCE_USERNAME'),
    string(credentialsId: 'ddfd04fb-e00a-4df0-9250-9a7cb37bce0e', variable: 'COMMON_IDENTITY_CLIENT_SECRET'),
    string(credentialsId: 'NPM_TOKEN', variable: 'NPM_TOKEN')
  ]) {
    def secrets = ""
    secrets += "COMMON_IDENTITY_CLIENT_SECRET=${COMMON_IDENTITY_CLIENT_SECRET}\n"
    secrets += "CISCOSPARK_APPID_SECRET=${CISCOSPARK_APPID_SECRET}\n"
    secrets += "CISCOSPARK_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}\n"
    secrets += "SAUCE_USERNAME=${SAUCE_USERNAME}\n"
    secrets += "SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}\n"
    secrets += "NPM_TOKEN=${NPM_TOKEN}"
    writeFile file: ENV_FILE, text: secrets
  }
}

ansiColor('xterm') {
  timestamps {
    timeout(90) {

      node("SPARK_JS_SDK_VALIDATING") {
        try {
          // Set the description to blank so we can use +=
          currentBuild.description = ''

          env.CONCURRENCY = 4
          env.NPM_CONFIG_REGISTRY = "http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group"
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

          DOCKER_ENV_FILE = "${env.WORKSPACE}/docker-env"
          ENV_FILE = "${env.WORKSPACE}/.env"

          DOCKER_RUN_OPTS = ''
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

          stage('checkout') {
            checkout scm
            if (IS_VALIDATED_MERGE_BUILD) {
              try {
                pusher = sh script: 'git show  --quiet --format=%ae HEAD', returnStdout: true
                currentBuild.description += "Validating push from ${pusher}"
              }
              catch (err) {
                currentBuild.description += 'Could not determine pusher';
              }

              sshagent(['30363169-a608-4f9b-8ecc-58b7fb87181b']) {
                // return the exit code because we don't care about failures
                sh script: 'git remote add upstream git@github.com:ciscospark/spark-js-sdk.git', returnStatus: true
                // Make sure local tags don't include failed releases
                sh 'git tag | xargs git tag -d'
                sh 'git gc'

                sh 'git fetch upstream --tags'
              }

              try {
                sh 'git diff --name-only upstream/master | grep -v src/version.js | grep -e ^src'
                HAS_LEGACY_CHANGES = true
              }
              catch (error) {
                HAS_LEGACY_CHANGES = false
              }

              sh 'git checkout upstream/master'
              try {
                sh "git merge --ff ${GIT_COMMIT}"
              }
              catch (err) {
                currentBuild.description += 'not possible to fast forward'
                throw err;
              }

              // Copy the global git user details into the local repo so that the
              // docker containers have access to it.
              sh 'git config user.email spark-js-sdk.gen@cisco.com'
              sh 'git config user.name Jenkins'
            }

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
              sh 'npm install'
              sh 'npm run bootstrap'
            }
          }

          stage('clean') {
            sh 'git clean -df'
            image.inside(DOCKER_RUN_OPTS) {
              sh 'npm run grunt -- clean'
              sh 'npm run grunt:concurrent -- clean'
              sh 'npm run clean-empty-packages'
            }
            sh 'rm -rf "packages/*/browsers.processed.js"'
            sh 'rm -rf ".sauce/*/sc.*"'
            sh 'rm -rf ".sauce/*/sauce_connect*log"'
            sh 'rm -rf reports'
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
              // running eslint once across all package. We still get
              // per-package eslint config, it just means that e.g. stylelint is
              // skipped for now. Given the widgets are moving to another repo,
              // I think this is ok.
              image.inside(DOCKER_RUN_OPTS) {
                sh 'npm run depcheck'
                sh script: "npm run grunt:concurrent -- eslint", returnStatus: true
                if (!fileExists("./reports/style/eslint-concurrent.xml")) {
                  error('Static Analysis did not produce eslint-concurrent.xml')
                }
                sh script: "npm run grunt -- eslint", returnStatus: true
                if (!fileExists("./reports/style/eslint-legacy.xml")) {
                  error('Static Analysis did not produce eslint-legacy.xml')
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
              }
            }

            stage('test') {
              timeout(45) {
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

          if (env.COVERAGE && currentBuild.result == 'SUCCESS') {
            stage('process coverage') {
              image.inside(DOCKER_RUN_OPTS) {
                sh 'npm run grunt:circle -- coverage'
              }
              archive 'reports/cobertura.xml'

              // At the time this script was written, the cobertura plugin didn't
              // support pipelines, so we need to use a freeform job to process
              // code coverage
              coverageBuild = build job: 'spark-js-sdk--validated-merge--coverage-processor', propagate: false
              if (coverageBuild.result != 'SUCCESS') {
                currentBuild.result = coverageBuild.result
                if (coverageBuild.result == 'UNSTABLE') {
                  currentBuild.description += coverageBuild.description
                }
                else if (coverageBuild.result == 'FAILURE') {
                  currentBuild.description += "Coverage job failed. See the logged build url for more details."
                }
              }
            }

            def version = ''
            if (IS_VALIDATED_MERGE_BUILD && currentBuild.result == 'SUCCESS') {
              stage('build for release') {
                env.NODE_ENV = ''
                image.inside(DOCKER_RUN_OPTS) {
                  version = sh script: 'npm run --silent get-next-version', returnStdout: true
                  if ("${version}" == '') {
                    warn('failed to determine next version');
                    error('failed to determine next version');
                  }
                  echo "next version is ${version}"
                  sh 'npm run build'
                  sh 'npm run grunt:concurrent -- build:docs'
                  sh 'PACKAGE=example-phone npm run grunt:package -- webpack:build'
                  sh 'PACKAGE=widget-message-meet npm run grunt:package build'

                  if (HAS_LEGACY_CHANGES) {
                    sh 'npm run grunt -- release'
                  }
                  try {
                    sh script: "npm run lerna --silent -- publish --skip-npm --skip-git  --yes --repo-version=${version}"
                    sh 'git add lerna.json packages/*/package.json'
                    sh "git commit -m v${version}"
                    sh "git tag 'v${version}'"
                  }
                  catch (error) {
                    // ignore: no packages to update
                  }
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
                    currentBuild.description += 'Aborted: git history includes #no-push'
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
                sshagent(['30363169-a608-4f9b-8ecc-58b7fb87181b']) {
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
                  // TODO use lerna publish directly now that npm fixed READMEs
                  // reminder: need to write to ~ not . because lerna runs npm
                  // commands in subdirectories
                  image.inside(DOCKER_RUN_OPTS) {
                    def registry = env.NPM_CONFIG_REGISTRY
                    env.NPM_CONFIG_REGISTRY = ''
                    sh 'echo \'//registry.npmjs.org/:_authToken=${NPM_TOKEN}\' > $HOME/.npmrc'
                    echo ''
                    echo ''
                    echo ''
                    echo 'Reminder: E403 errors below are normal. They occur for any package that has no updates to publish'
                    echo ''
                    echo ''
                    echo ''
                    sh 'NPM_CONFIG_REGISTRY="" npm run lerna -- exec -- bash -c \'npm publish --access public || true\''
                    echo ''
                    echo ''
                    echo ''
                    echo 'Reminder: E403 errors above are normal. They occur for any package that has no updates to publish'
                    echo ''
                    echo ''
                    echo ''
                    env.NPM_CONFIG_REGISTRY = registry
                  }
                  if ("${version}" == '') {
                    warn('could not determine tag name to push to github.com')
                  }
                  else {
                    sshagent(['30363169-a608-4f9b-8ecc-58b7fb87181b']) {
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

              stage('publish docs') {
                try {
                  image.inside(DOCKER_RUN_OPTS) {
                    // It's kinda ridiculous, but this seems like the most
                    // effective way to make sure we set the git username at the
                    // right time without horrible bash scripts that check what
                    // folders do or do not exist
                    sh 'npm run grunt:concurrent -- publish:docs'
                  }
                  dir('.grunt/grunt-gh-pages/gh-pages/ghc') {
                    sshagent(['30363169-a608-4f9b-8ecc-58b7fb87181b']) {
                      try {
                        sh 'git remote add upstream git@github.com:ciscospark/spark-js-sdk.git'
                      }
                      catch(err) {
                        // ignore; this happens when the node exist
                      }
                      sh 'git push upstream gh-pages:gh-pages'
                    }
                  }
                }
                catch (error) {
                  warn("failed to publish docs ${error.toString()}")
                }

              }

              stage('publish to ghe') {
                // def exitStatus = sh script: 'git remote | grep -qc ghe', returnStatus: true
                // if (exitStatus == 1) {
                //   sh 'git remote add ghe git@sqbu-github.cisco.com:WebExSquared/spark-js-sdk.git'
                // }
                // exitStatus = sh script: 'git push ghe HEAD:master', returnStatus: true
                // if (!exitStatus) {
                //   warn('failed to push to github enterprise')
                // }
              }

              stage('publish to artifactory') {
                if (HAS_LEGACY_CHANGES) {
                  // using a downstream job because (a) we're going to stop
                  // publishing to artifactory once the legacy sdk goes away and
                  // (b) the npm secret is only recorded in that job.
                  def artifactoryBuild = build job: 'spark-js-sdk--publish-to-artifactory', propagate: false
                  if (artifactoryBuild.result != 'SUCCESS') {
                    currentBuild.description += 'waring: failed to publish to Artifactory'
                  }
                }
              }
            }
          }

          cleanup(IS_VALIDATED_MERGE_BUILD)
        }
        catch(error) {
          // Read junit again because we may have gotten here due to a timeout
          try {
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
