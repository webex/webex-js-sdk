// Timeouts — SDK timeout + 5s buffer for network/UI overhead
export const AWAIT_TIMEOUT = 10000; // General UI interactions
export const SDK_INIT_TIMEOUT = 65000; // RETRY_TIMER_UPPER_LIMIT (60s) + 5s
export const REGISTRATION_TIMEOUT = 35000; // BASE_REG_RETRY_TIMER_VAL_IN_SEC (30s) + 5s
export const OPERATION_TIMEOUT = 15000; // SUPPLEMENTARY_SERVICES_TIMEOUT (10s) + 5s
