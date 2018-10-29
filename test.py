import os

# Gather the packages to test.

PREFIX = './packages/node_modules/'

def get_package_names(path_name):
  namespace = path_name.replace(PREFIX, '')
  return [os.path.join(namespace, name) for name in os.listdir(path_name) if os.path.isdir(os.path.join(path_name, name))]

CISCOSPARK = PREFIX + '@ciscospark'
WEBEX = PREFIX + '@webex'

ciscospark_packages = get_package_names(CISCOSPARK)
webex_packages = get_package_names(WEBEX)

packages = ciscospark_packages + webex_packages

print('Testing %d packages...' % len(packages))

# Test the packages & write the results to a CSV file.

PROD_ENV_VARS = {
  'ATLAS_SERVICE_URL': 'https://atlas-a.wbx2.com/admin/api/v1',
  'CONVERSATION_SERVICE': 'https://conv-a.wbx2.com/conversation/api/v1',
  'ENCRYPTION_SERVICE_URL': 'https://encryption-a.wbx2.com',
  'IDBROKER_BASE_URL': 'https://idbroker.webex.com',
  'IDENTITY_BASE_URL': 'https://identity.webex.com',
  'WDM_SERVICE_URL': 'https://wdm-a.wbx2.com/wdm/api/v1',
  'ENABLE_VERBOSE_NETWORK_LOGGING': 'true'
}

INT_ENV_VARS = {
  'ACL_SERVICE_URL': 'https://acl-intb.ciscospark.com/acl/api/v1',
  'ATLAS_SERVICE_URL': 'https://atlas-intb.ciscospark.com/admin/api/v1',
  'CONVERSATION_SERVICE': 'https://conversation-intb.ciscospark.com/conversation/api/v1',
  'ENCRYPTION_SERVICE_URL': 'https://encryption-intb.ciscospark.com/encryption/api/v1',
  'IDBROKER_BASE_URL': 'https://idbrokerbts.webex.com',
  'IDENTITY_BASE_URL': 'https://identitybts.webex.com',
  'WDM_SERVICE_URL': 'https://wdm-intb.ciscospark.com/wdm/api/v1',
  # 'WDM_SERVICE_URL': 'https://wdm.intb1.ciscospark.com/wdm/api/v1',
  'ENABLE_VERBOSE_NETWORK_LOGGING': 'true'
}

TEST_COMMAND = 'npm test -- --package %s --node'

import csv
import subprocess

try:
  os.mkdir('output')
except OSError:
  pass

OUTPUT_FILE_PATH = './output/test-comparison.csv'

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


with open(OUTPUT_FILE_PATH, 'wb') as csvfile:
  writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)
  writer.writerow(['Package', 'Production exit code', 'Integration exit code'])
  for package in packages:
    bash_command = TEST_COMMAND % package

    # Test production.
    print(bcolors.OKBLUE + 'Testing `%s` on production...' % package + bcolors.ENDC)
    prod_return_code = run_subprocess(bash_command, PROD_ENV_VARS)
    print_result(prod_return_code, prefix='Testing `%s` on production...' % package)

    # Test integration.
    print(bcolors.OKBLUE + 'Testing `%s` on integration...' % package + bcolors.ENDC)
    int_return_code = run_subprocess(bash_command, INT_ENV_VARS)
    print_result(int_return_code, prefix='Testing `%s` on integration...' % package)

    writer.writerow([package, prod_return_code, int_return_code])
    csvfile.flush()

print('Wrote output to: %s' % OUTPUT_FILE_PATH)
print('Done.')
