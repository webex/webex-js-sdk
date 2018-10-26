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

# Test the packages.

# PROD_ENV_VARS = '''IDBROKER_BASE_URL="https://idbroker.webex.com" \\
# IDENTITY_BASE_URL="https://identity.webex.com" \\
# WDM_SERVICE_URL="https://wdm-a.wbx2.com/wdm/api/v1" \\
# CONVERSATION_SERVICE_URL="https://conv-a.wbx2.com/conversation/api/v1" \\
# ENCRYPTION_SERVICE_URL="https://encryption-a.wbx2.com" \\
# ATLAS_SERVICE_URL="https://atlas-a.wbx2.com/admin/api/v1" \\
# '''

# INT_ENV_VARS = '''ACL_SERVICE_URL="https://acl-intb.ciscospark.com/acl/api/v1" \\
# IDBROKER_BASE_URL="https://idbrokerbts.webex.com" \\
# IDENTITY_BASE_URL="https://identitybts.webex.com" \\
# WDM_SERVICE_URL="https://wdm-intb.ciscospark.com/wdm/api/v1" \\
# CONVERSATION_SERVICE_URL="https://conversation-intb.ciscospark.com/conversation/api/v1" \\
# ENCRYPTION_SERVICE_URL="https://encryption-intb.ciscospark.com/encryption/api/v1" \\
# ATLAS_SERVICE_URL="https://atlas-intb.ciscospark.com/admin/api/v1" \\
# '''

# PROD_ENV_VARS = [
#   'ATLAS_SERVICE_URL="https://atlas-a.wbx2.com/admin/api/v1"',
#   'CONVERSATION_SERVICE_URL="https://conv-a.wbx2.com/conversation/api/v1"',
#   'ENCRYPTION_SERVICE_URL="https://encryption-a.wbx2.com"',
#   'IDBROKER_BASE_URL="https://idbroker.webex.com"',
#   'IDENTITY_BASE_URL="https://identity.webex.com"',
#   'WDM_SERVICE_URL="https://wdm-a.wbx2.com/wdm/api/v1"',
# ]

# INT_ENV_VARS = [
#   'ACL_SERVICE_URL="https://acl-intb.ciscospark.com/acl/api/v1"',
#   'ATLAS_SERVICE_URL="https://atlas-intb.ciscospark.com/admin/api/v1"',
#   'CONVERSATION_SERVICE_URL="https://conversation-intb.ciscospark.com/conversation/api/v1"',
#   'ENCRYPTION_SERVICE_URL="https://encryption-intb.ciscospark.com/encryption/api/v1"',
#   'IDBROKER_BASE_URL="https://idbrokerbts.webex.com"',
#   'IDENTITY_BASE_URL="https://identitybts.webex.com"',
#   'WDM_SERVICE_URL="https://wdm-intb.ciscospark.com/wdm/api/v1"'
# ]

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
  'WDM_SERVICE_URL': 'https://wdm-intb.ciscospark.com/wdm/api/v1'
}

TEST_COMMAND = 'npm test -- --package %s'

import subprocess

for package in packages[0:1]:
  print('Testing `%s` on production...' % package)

  env = os.environ.copy()
  env.update(PROD_ENV_VARS)

  bash_command = TEST_COMMAND % package
  process = subprocess.Popen(bash_command.split(), stdout=subprocess.PIPE, env=env)

  output, error = process.communicate()

  print('output: ' + str(output))
  print('error: ' + str(error))
  print(process.returncode)

  exit(1)

  print('Testing `%s` on integration...' % package)
  print(TEST_COMMAND % (INT_ENV_VARS, package))

# bashCommand = "cwm --rdf test.rdf --ntriples > test.nt"
# process = subprocess.Popen(bashCommand.split(), stdout=subprocess.PIPE)
# output, error = process.communicate()

# Write the results to a CSV file.

import csv

try:
  os.mkdir('output')
except OSError:
  pass

OUTPUT_FILE_PATH = './output/test-comparison.csv'

with open(OUTPUT_FILE_PATH, 'wb') as csvfile:
  writer = csv.writer(csvfile, quoting=csv.QUOTE_MINIMAL)
  writer.writerow(['package'])
  for package in packages:
    writer.writerow([package])

print('Wrote output to: %s' % OUTPUT_FILE_PATH)
print('Done.')
