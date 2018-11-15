import csv
import os
import subprocess
import threading

# Gather the packages to test.

PREFIX = './packages/node_modules/'
CISCOSPARK = os.path.join(PREFIX, '@ciscospark')
WEBEX = os.path.join(PREFIX, '@webex')

PROD_ENV_VARS = {
  # 'ACL_SERVICE_URL': 'https://acl-a.wbx2.com/acl/api/v1', ?
  'ATLAS_SERVICE_URL': 'https://atlas-a.wbx2.com/admin/api/v1',
  'CONVERSATION_SERVICE': 'https://conv-a.wbx2.com/conversation/api/v1',
  'ENCRYPTION_SERVICE_URL': 'https://encryption-a.wbx2.com',
  'IDBROKER_BASE_URL': 'https://idbroker.webex.com',
  'IDENTITY_BASE_URL': 'https://identity.webex.com',
  'WDM_SERVICE_URL': 'https://wdm-a.wbx2.com/wdm/api/v1',
  # Logging
  'ENABLE_VERBOSE_NETWORK_LOGGING': 'true'
}

INT_ENV_VARS = {
  # Environments
  'ACL_SERVICE_URL': 'https://acl-intb.ciscospark.com/acl/api/v1',
  'ATLAS_SERVICE_URL': 'https://atlas-intb.ciscospark.com/admin/api/v1',
  'CONVERSATION_SERVICE': 'https://conversation-intb.ciscospark.com/conversation/api/v1',
  'ENCRYPTION_SERVICE_URL': 'https://encryption-intb.ciscospark.com/encryption/api/v1',
  # Do not use 'https://hydra-intb.ciscospark.com/v1' for Hydra. CI expects 'apialpha'.
  'HYDRA_SERVICE_URL': 'https://apialpha.ciscospark.com/v1/',
  'IDBROKER_BASE_URL': 'https://idbrokerbts.webex.com',
  'IDENTITY_BASE_URL': 'https://identitybts.webex.com',
  'WDM_SERVICE_URL': 'https://wdm-intb.ciscospark.com/wdm/api/v1',
  'WHISTLER_API_SERVICE_URL': 'https://whistler.onint.ciscospark.com/api/v1',
  # Logging
  'ENABLE_VERBOSE_NETWORK_LOGGING': 'true'
}

OUTPUT_DIR = 'output'
OUTPUT_FILE_PATH = os.path.join(OUTPUT_DIR, 'test-comparison.csv')

TEST_COMMAND = 'npm test -- --package %s'

SKIP_PACKAGES = [
  '@webex/bin-sauce-connect', # needs Sauce started
  # '@webex/plugin-meetings', # no tests
  # '@webex/test-helper-server' # no tests
  # '@ciscospark/internal-plugin-calendar', # no tests
  # '@ciscospark/plugin-webhooks' # no tests
]

def should_include_package(path_name, name):
  scoped_name = os.path.join(os.path.basename(path_name), name)
  return os.path.isdir(os.path.join(path_name, name)) and scoped_name not in SKIP_PACKAGES

def get_package_names(path_name):
  namespace = path_name.replace(PREFIX, '')
  return [os.path.join(namespace, name) for name in os.listdir(path_name) if should_include_package(path_name, name)]

def run_subprocess(bash_command, env_vars):
  env = os.environ.copy()
  env.update(env_vars)
  process = subprocess.Popen(bash_command.split(), stdout=subprocess.PIPE, env=env)

  output, error = process.communicate()
  return process.returncode # , output, error

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_result(return_code, prefix='Tests are a...'):
  if return_code == 0:
    print(bcolors.OKGREEN + prefix + 'success.' + bcolors.ENDC)
  else:
    print(bcolors.FAIL + prefix + 'failure.' + bcolors.ENDC)

def run_test(package, environment):
  env_vars = INT_ENV_VARS if environment is 'integration' else PROD_ENV_VARS
  print(bcolors.OKBLUE + 'Testing `%s` on %s...' % (package, environment) + bcolors.ENDC)
  bash_command = TEST_COMMAND % package
  return_code = run_subprocess(bash_command, env_vars)
  print_result(return_code, prefix='Testing `%s` on %s...' % (package, environment))
  return return_code

def run_env_tests(package, writer, csv_file):
  prod_return_code = run_test(package, 'production')
  int_return_code = run_test(package, 'integration')
  writer.writerow([package, prod_return_code, int_return_code])
  csv_file.flush()

def main():
  ciscospark_packages = get_package_names(CISCOSPARK)
  webex_packages = get_package_names(WEBEX)
  packages = ciscospark_packages + webex_packages
  print ('Skipping %d packages: %s' % (len(SKIP_PACKAGES), ', '.join(SKIP_PACKAGES)))
  print('Testing %d packages...' % len(packages))

  try:
    os.mkdir(OUTPUT_DIR)
  except OSError:
    pass

  threads = []

  with open(OUTPUT_FILE_PATH, 'wb') as csv_file:
    writer = csv.writer(csv_file, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(['Package', 'Production exit code', 'Integration exit code'])

    for package in packages:
      run_env_tests(package, writer, csv_file)

    # threads = [threading.Thread(target=run_env_tests, args=(package, writer, csv_file)) for package in packages]
    # for thread in threads:
    #   thread.start()
    # for thread in threads:
    #   thread.join()

  print('Wrote output to: %s' % OUTPUT_FILE_PATH)
  print('Done.')

if __name__ == "__main__":
  main()
