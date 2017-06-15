def cleanup() {
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

def generateDockerEnv(filename) {
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
  writeFile file: filename, text: dockerEnv
}

def generateSecretsFile(filename) {
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
    writeFile file: filename, text: secrets
  }
}

def warn(msg) {
  if (currentBuild.description.substring(currentBuild.description.length() - 1) != '\n') {
    currentBuild.description += '<br/>\n'
  }
  currentBuild.description += "warning: ${msg}<br/>\n"
}

def setPusher() {
  try {
    pusher = sh script: 'git show  --quiet --format=%ae HEAD', returnStdout: true
    currentBuild.description += "Validating push from ${pusher}"
  }
  catch (err) {
    currentBuild.description += 'Could not determine pusher';
  }
}

def guardToolingChanges() {
  def changedFiles = sh script: 'git diff --name-only upstream/master..$(git merge-base HEAD upstream/master)', returnStdout: true
  if (changedFiles.contains('Jenkinsfile')) {
    currentBuild.description += "Jenkinsfile has been updated in master. Please rebase and push again."
    error(currentBuild.description)
  }
}

return this
