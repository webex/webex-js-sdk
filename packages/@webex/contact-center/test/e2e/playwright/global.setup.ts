import {test as setup} from '@playwright/test';
import dotenv from 'dotenv';
import {oauthLogin} from './Utils/initUtils';
import {USER_SETS} from './test-data';
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env.contact-center.e2e');
dotenv.config({path: envPath});

setup('OAuth', async ({browser}) => {
  // Directly iterate through USER_SETS and their agents
  for (const setKey of Object.keys(USER_SETS)) {
    const userSet = USER_SETS[setKey];

    for (const agentKey of Object.keys(userSet.AGENTS)) {
      const accessTokenKey = `${setKey}_${agentKey}_ACCESS_TOKEN`;
      const existingAccessToken = process.env[accessTokenKey];
      if (existingAccessToken && existingAccessToken.trim()) {
        continue;
      }
      const page = await browser.newPage();

      const usernameKey = `${setKey}_${agentKey}_USERNAME`;
      const oauthAgentId = process.env[usernameKey];
      if (!oauthAgentId) {
        throw new Error(`Missing OAuth username for ${setKey}/${agentKey}. Set ${usernameKey} in .env.contact-center.e2e.`);
      }
      const passwordKey = `${setKey}_${agentKey}_PASSWORD`;
      const agentPassword = process.env[passwordKey];
      if (!agentPassword) {
        throw new Error(`Missing OAuth password for ${oauthAgentId}. Set ${passwordKey} in .env.contact-center.e2e.`);
      }

      await oauthLogin(page, oauthAgentId, agentPassword);

      await page.waitForFunction(() => {
        const tokenInput = document.querySelector('#access-token');
        return Boolean(tokenInput && tokenInput.value && tokenInput.value.trim().length > 0);
      });
      const accessToken = await page.locator('#access-token').inputValue();

      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
        // Remove any existing ACCESS_TOKEN line for this set-agent combination
        const accessTokenPattern = new RegExp(`^${setKey}_${agentKey}_ACCESS_TOKEN=.*$\\n?`, 'm');
        envContent = envContent.replace(accessTokenPattern, '');

        // Ensure trailing newline
        if (!envContent.endsWith('\n')) envContent += '\n';
      }
      envContent += `${setKey}_${agentKey}_ACCESS_TOKEN=${accessToken}\n`;
      // Clean up multiple consecutive empty lines
      envContent = envContent.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(envPath, envContent, 'utf8');

      await page.close();
    }
  }
});
