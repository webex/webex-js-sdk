/* eslint-disable import/no-extraneous-dependencies, import/prefer-default-export */
import {test as setup} from '@playwright/test';
import {oauthLogin} from './Utils/initUtils';
import {USER_SETS} from './test-data';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

export const UpdateENVWithUserSets = () => {
  const domain = process.env.PW_SANDBOX;
  const envPath = path.resolve(__dirname, '.env');

  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  (Object.keys(USER_SETS) as Array<keyof typeof USER_SETS>).forEach((setKey) => {
    const userSet = USER_SETS[setKey];

    (Object.keys(userSet.AGENTS) as Array<keyof typeof userSet.AGENTS>).forEach((agentKey) => {
      const agent = userSet.AGENTS[agentKey];

      const usernamePattern = new RegExp(`^${setKey}_${agentKey}_USERNAME=.*$\\n?`, 'm');
      const extensionPattern = new RegExp(`^${setKey}_${agentKey}_EXTENSION_NUMBER=.*$\\n?`, 'm');
      const namePattern = new RegExp(`^${setKey}_${agentKey}_NAME=.*$\\n?`, 'm');

      envContent = envContent.replace(usernamePattern, '');
      envContent = envContent.replace(extensionPattern, '');
      envContent = envContent.replace(namePattern, '');

      if (!envContent.endsWith('\n') && envContent.length > 0) envContent += '\n';
      envContent += `${setKey}_${agentKey}_USERNAME=${agent.username}@${domain}\n`;
      envContent += `${setKey}_${agentKey}_EXTENSION_NUMBER=${agent.extension}\n`;
      envContent += `${setKey}_${agentKey}_NAME=${agent.agentName || ''}\n`;
    });

    const dialPattern = new RegExp(`^${setKey}_ENTRY_POINT=.*$\\n?`, 'm');
    const emailPattern = new RegExp(`^${setKey}_EMAIL_ENTRY_POINT=.*$\\n?`, 'm');
    const queuePattern = new RegExp(`^${setKey}_QUEUE_NAME=.*$\\n?`, 'm');
    const chatPattern = new RegExp(`^${setKey}_CHAT_URL=.*$\\n?`, 'm');

    envContent = envContent.replace(dialPattern, '');
    envContent = envContent.replace(emailPattern, '');
    envContent = envContent.replace(queuePattern, '');
    envContent = envContent.replace(chatPattern, '');

    if (!envContent.endsWith('\n') && envContent.length > 0) envContent += '\n';
    envContent += `${setKey}_ENTRY_POINT=${userSet.ENTRY_POINT || ''}\n`;
    envContent += `${setKey}_EMAIL_ENTRY_POINT=${userSet.EMAIL_ENTRY_POINT || ''}\n`;
    envContent += `${setKey}_QUEUE_NAME=${userSet.QUEUE_NAME || ''}\n`;
    envContent += `${setKey}_CHAT_URL=${userSet.CHAT_URL || ''}\n`;
  });

  envContent = envContent.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(envPath, envContent, 'utf8');
};

setup('OAuth', async ({browser}) => {
  UpdateENVWithUserSets();

  for (const setKey of Object.keys(USER_SETS) as Array<keyof typeof USER_SETS>) {
    const userSet = USER_SETS[setKey];

    for (const agentKey of Object.keys(userSet.AGENTS) as Array<keyof typeof userSet.AGENTS>) {
      // eslint-disable-next-line no-await-in-loop
      const page = await browser.newPage();
      const username = `${userSet.AGENTS[agentKey].username}@${process.env.PW_SANDBOX}`;

      // eslint-disable-next-line no-await-in-loop
      await oauthLogin(page, username);

      // eslint-disable-next-line no-await-in-loop
      const accessToken = await page
        .evaluate(() => {
          const inputToken =
            (document.querySelector('#access-token') as HTMLInputElement | null)?.value || '';
          const sessionToken = sessionStorage.getItem('access-token') || '';

          return inputToken.trim() || sessionToken.trim();
        })
        .catch(() => '');
      if (!accessToken || !accessToken.trim()) {
        throw new Error(`OAuth did not produce an access token for ${setKey}_${agentKey}`);
      }

      const envPath = path.resolve(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      const accessTokenPattern = new RegExp(`^${setKey}_${agentKey}_ACCESS_TOKEN=.*$\\n?`, 'm');
      envContent = envContent.replace(accessTokenPattern, '');
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += `${setKey}_${agentKey}_ACCESS_TOKEN=${accessToken}\n`;
      envContent = envContent.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(envPath, envContent, 'utf8');

      // eslint-disable-next-line no-await-in-loop
      await page.close();
    }
  }

  const dialNumberUsername = process.env.PW_DIAL_NUMBER_LOGIN_USERNAME;
  const dialNumberPassword = process.env.PW_DIAL_NUMBER_LOGIN_PASSWORD;

  if (dialNumberUsername && dialNumberPassword) {
    // eslint-disable-next-line no-await-in-loop
    const page = await browser.newPage();
    // eslint-disable-next-line no-await-in-loop
    await oauthLogin(page, dialNumberUsername, dialNumberPassword);

    // eslint-disable-next-line no-await-in-loop
    const accessToken = await page
      .evaluate(() => {
        const inputToken =
          (document.querySelector('#access-token') as HTMLInputElement | null)?.value || '';
        const sessionToken = sessionStorage.getItem('access-token') || '';

        return inputToken.trim() || sessionToken.trim();
      })
      .catch(() => '');
    if (accessToken && accessToken.trim()) {
      const envPath = path.resolve(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      envContent = envContent.replace(/^DIAL_NUMBER_LOGIN_ACCESS_TOKEN=.*$\n?/m, '');
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += `DIAL_NUMBER_LOGIN_ACCESS_TOKEN=${accessToken}\n`;
      envContent = envContent.replace(/\n{3,}/g, '\n\n');
      fs.writeFileSync(envPath, envContent, 'utf8');
    }

    // eslint-disable-next-line no-await-in-loop
    await page.close();
  }
});
