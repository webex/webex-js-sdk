/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * The `webex.request` method, as consumed across the plugin. Injected already bound to the webex
 * instance (`webex.request.bind(webex)`) so a collaborator can depend on this single function
 * rather than the whole webex object.
 */
export type WebexRequestMethod = (options: Record<string, any>) => Promise<any>;
