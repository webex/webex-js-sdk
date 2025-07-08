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
}
