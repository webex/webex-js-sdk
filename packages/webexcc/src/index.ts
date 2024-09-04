import WebexCCSDK from './WebexCCSDK';

const createWebexCCSDK = (webex: any): WebexCCSDK => {
  const webexCCSDKInstance = new WebexCCSDK(webex);

  return webexCCSDKInstance;
};

export default createWebexCCSDK;
