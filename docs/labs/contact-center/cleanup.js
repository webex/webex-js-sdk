/**
 * Cleanup functionality for Contact Center SDK
 * Shows both simple window.webex usage and robust implementation
 */

/**
 * Perform cleanup operations before page unload
 * Simple usage from lab.html:
 * window.webex.cc.stationLogout({ 
 *     logoutReason: 'pageUnload',
 *     deviceId: 'current_device_id'
 * });
 * await window.webex.cc.deregister();
 * 
 * @param {Object} webex - Webex SDK instance
 * @param {string} deviceId - Current device ID
 * @returns {Promise<void>}
 */
export async function performCleanup(webex, deviceId) {
    if (!webex?.cc) return;

    try {
        // Attempt station logout if logged in
        if (deviceId) {
            await webex.cc.stationLogout({
                logoutReason: 'pageUnload',
                deviceId
            });
            console.log('Station logged out during cleanup');
        }

        // Always attempt deregistration
        await webex.cc.deregister();
        console.log('Agent deregistered during cleanup');
    } catch (error) {
        console.error('Cleanup failed:', error);
        // Continue with cleanup even if errors occur
    }
}

/**
 * Setup cleanup handlers for page unload and visibility change
 * Simple usage from lab.html:
 * window.addEventListener('beforeunload', async () => {
 *     await window.webex.cc.deregister();
 * });
 * 
 * @param {Object} webex - Webex SDK instance
 * @param {string} deviceId - Current device ID
 */
export function setupCleanupHandlers(webex, deviceId) {
    // Handle page unload
    window.addEventListener('beforeunload', async (event) => {
        // Show confirmation dialog
        event.preventDefault();
        event.returnValue = '';

        await performCleanup(webex, deviceId);
    });

    // Handle tab visibility change
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden') {
            await performCleanup(webex, deviceId);
        }
    });
}

/**
 * Remove cleanup handlers
 * Call this when cleaning up components or changing pages
 */
export function removeCleanupHandlers() {
    window.removeEventListener('beforeunload', performCleanup);
    document.removeEventListener('visibilitychange', performCleanup);
}

/**
 * Setup error handlers for unexpected cleanup scenarios
 * @param {Object} webex - Webex SDK instance
 */
export function setupErrorHandlers(webex) {
    window.addEventListener('error', async (event) => {
        console.error('Global error caught, attempting cleanup:', event.error);
        await performCleanup(webex, window.deviceId);
    });

    window.addEventListener('unhandledrejection', async (event) => {
        console.error('Unhandled promise rejection, attempting cleanup:', event.reason);
        await performCleanup(webex, window.deviceId);
    });
}

/**
 * Initialize all cleanup handlers
 * @param {Object} webex - Webex SDK instance
 * @param {string} deviceId - Current device ID
 */
export function initializeCleanup(webex, deviceId) {
    setupCleanupHandlers(webex, deviceId);
    setupErrorHandlers(webex);

    // Log cleanup initialization
    console.log('Cleanup handlers initialized for deviceId:', deviceId);
}

// Private helper functions
function logCleanupAttempt(type, success = true) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Cleanup ${type}: ${success ? 'succeeded' : 'failed'}`);
}
