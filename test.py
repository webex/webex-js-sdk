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
  'ATLAS_SERVICE_URL': "https://atlas-a.wbx2.com/admin/api/v1",
  'CONVERSATION_SERVICE_URL': "https://conv-a.wbx2.com/conversation/api/v1",
  'ENCRYPTION_SERVICE_URL': "https://encryption-a.wbx2.com",
  'IDBROKER_BASE_URL': "https://idbroker.webex.com",
  'IDENTITY_BASE_URL': "https://identity.webex.com",
  'WDM_SERVICE_URL': "https://wdm-a.wbx2.com/wdm/api/v1",
}

INT_ENV_VARS = {
  'ACL_SERVICE_URL': 'https://acl-intb.ciscospark.com/acl/api/v1',
  'ATLAS_SERVICE_URL': 'https://atlas-intb.ciscospark.com/admin/api/v1',
  'CONVERSATION_SERVICE_URL': 'https://conversation-intb.ciscospark.com/conversation/api/v1',
  'ENCRYPTION_SERVICE_URL': 'https://encryption-intb.ciscospark.com/encryption/api/v1',
  'IDBROKER_BASE_URL': 'https://idbrokerbts.webex.com',
  'IDENTITY_BASE_URL': 'https://identitybts.webex.com',
  'WDM_SERVICE_URL': 'https://wdm.intb1.ciscospark.com/wdm/api/v1'
}

TEST_COMMAND = 'npm test -- --package %s'

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

with open(OUTPUT_FILE_PATH, 'wb') as csvfile:
  writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)
  writer.writerow(['Package', 'Production exit code', 'Integration exit code'])
  for package in packages[0:1]:
    bash_command = TEST_COMMAND % package

    print('Testing `%s` on production...' % package)
    prod_return_code = run_subprocess(bash_command, PROD_ENV_VARS)

    print('Testing `%s` on integration...' % package)
    int_return_code = run_subprocess(bash_command, INT_ENV_VARS)

    writer.writerow([package, prod_return_code, int_return_code])

print('Wrote output to: %s' % OUTPUT_FILE_PATH)
print('Done.')
