declare module 'ampersand-collection' {
  class AmpCollection {
    static extend(options: any): any;
  }

  export = AmpCollection;
}
declare module 'javascript-state-machine' {
  class StateMachine {
    constructor(config: any);
  }

  export = StateMachine;
}

declare module 'javascript-state-machine/lib/history' {
  class StateMachineHistory {
    constructor(options?: any);
  }

  export = StateMachineHistory;
}

declare module '@webex/webex-core' {
  class WebexPlugin {
    constructor(...args: any);
    static extend(properties: any): any;
  }
  class StatelessWebexPlugin {
    constructor(attrs: any, options: any);
    webex: any;
    trigger: any;
    config: any;
  }
  function registerPlugin(name: string, constructor: any, options?: any): void;
  export const config: any;

  export {WebexPlugin, StatelessWebexPlugin, registerPlugin};
}

declare module '@webex/common' {
  class Defer {
    promise: Promise<any>;
    resolve: any;
    reject: any;
  }
  export const deconstructHydraId: any;
  export const deviceType: any;

  export {Defer};
}

declare module 'btoa' {
  const btoa: any;

  export default btoa;
}

declare module '@webex/http-core' {
  class Interceptor {}

  export {Interceptor};
}

declare module 'global/window' {
  const window: Window;
  export = window;
}
