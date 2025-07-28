/* eslint-disable require-jsdoc */
/* eslint-env browser */
/* eslint-disable no-console */

/**
 * Global Error Handler with Modal Display
 * Handles HTTP errors, runtime errors, and displays them in a styled modal
 */

class ErrorHandler {
  constructor() {
    this.modalId = 'webex-error-modal';
    this.init();
  }

  init() {
    // Add global error handlers
    this.setupGlobalErrorHandlers();
    // Create modal HTML structure
    this.createModal();
    // Add modal styles
    this.addStyles();
    // Hide webpack dev server overlay
    this.hideWebpackOverlay();
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError({
        type: 'Runtime Error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: 'Promise Rejection',
        message: event.reason?.message || event.reason,
        stack: event.reason?.stack,
        details: event.reason,
      });
    });

    // Override fetch to catch HTTP errors
    this.setupFetchInterceptor();
    // Override XMLHttpRequest to catch XHR errors
    this.setupXHRInterceptor();
  }

  setupFetchInterceptor() {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      try {
        const response = await originalFetch.apply(window, args);

        // Check if response is not ok (4xx, 5xx status codes)
        if (!response.ok) {
          const url = args[0];
          const method = args[1]?.method || 'GET';

          const errorDetails = {
            type: 'HTTP Error',
            status: response.status,
            statusText: response.statusText,
            url,
            method,
          };

          // Try to extract error details from response
          try {
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('text/html')) {
              const htmlText = await response.clone().text();
              const parser = new DOMParser();
              const doc = parser.parseFromString(htmlText, 'text/html');
              const title =
                doc.querySelector('title')?.textContent ||
                `${response.status} ${response.statusText}`;
              const body =
                doc.querySelector('h1')?.textContent ||
                doc.querySelector('body')?.textContent?.substring(0, 200) ||
                '';

              errorDetails.message = title;
              errorDetails.details = body;
            } else if (contentType?.includes('application/json')) {
              const jsonError = await response.clone().json();
              errorDetails.message =
                jsonError.message || jsonError.error || `${response.status} ${response.statusText}`;
              errorDetails.details = JSON.stringify(jsonError, null, 2);
            } else {
              const textError = await response.clone().text();
              errorDetails.message =
                textError.substring(0, 100) || `${response.status} ${response.statusText}`;
              errorDetails.details = textError;
            }
          } catch (parseError) {
            errorDetails.message = `${response.status} ${response.statusText}`;
            errorDetails.details = 'Unable to parse error response';
          }

          // Extract tracking ID from headers if present
          const trackingId =
            response.headers.get('webex-tracking-id') ||
            response.headers.get('x-request-id') ||
            response.headers.get('x-trace-id');
          if (trackingId) {
            errorDetails.trackingId = trackingId;
          }

          this.handleError(errorDetails);
        }

        return response;
      } catch (networkError) {
        this.handleError({
          type: 'Network Error',
          message: networkError.message,
          details: 'Failed to connect to server. Please check your internet connection.',
          stack: networkError.stack,
        });
        throw networkError;
      }
    };
  }

  setupXHRInterceptor() {
    const originalXHR = window.XMLHttpRequest;
    const self = this;

    window.XMLHttpRequest = function XMLHttpRequestWrapper() {
      // eslint-disable-next-line new-cap
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      let method = 'GET';
      let url = '';

      xhr.open = function (m, u, ...args) {
        method = m;
        url = u;

        return originalOpen.apply(this, [m, u, ...args]);
      };

      xhr.send = function (...args) {
        const originalOnReadyStateChange = xhr.onreadystatechange;

        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
            // Check for HTTP errors
            if (xhr.status >= 400) {
              const errorDetails = {
                type: 'HTTP Error (XHR)',
                status: xhr.status,
                statusText: xhr.statusText,
                url,
                method,
              };

              // Try to parse response
              try {
                const contentType = xhr.getResponseHeader('content-type') || '';
                if (contentType.includes('application/json')) {
                  const jsonError = JSON.parse(xhr.responseText);
                  errorDetails.message =
                    jsonError.message || jsonError.error || `${xhr.status} ${xhr.statusText}`;
                  errorDetails.details = JSON.stringify(jsonError, null, 2);
                } else if (contentType.includes('text/html')) {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(xhr.responseText, 'text/html');
                  const title =
                    doc.querySelector('title')?.textContent || `${xhr.status} ${xhr.statusText}`;
                  const body =
                    doc.querySelector('h1')?.textContent || xhr.responseText.substring(0, 200);

                  errorDetails.message = title;
                  errorDetails.details = body;
                } else {
                  errorDetails.message =
                    xhr.responseText.substring(0, 100) || `${xhr.status} ${xhr.statusText}`;
                  errorDetails.details = xhr.responseText;
                }
              } catch (parseError) {
                errorDetails.message = `${xhr.status} ${xhr.statusText}`;
                errorDetails.details = 'Unable to parse error response';
              }

              // Extract tracking ID from headers
              const trackingId =
                xhr.getResponseHeader('webex-tracking-id') ||
                xhr.getResponseHeader('x-request-id') ||
                xhr.getResponseHeader('x-trace-id');
              if (trackingId) {
                errorDetails.trackingId = trackingId;
              }

              self.handleError(errorDetails);
            }
          }

          if (originalOnReadyStateChange) {
            originalOnReadyStateChange.call(this);
          }
        };

        // Handle network errors
        xhr.onerror = function () {
          self.handleError({
            type: 'Network Error (XHR)',
            message: 'Network request failed',
            details: `Failed to ${method} ${url}. Please check your internet connection.`,
            url,
            method,
          });
        };

        xhr.ontimeout = function () {
          self.handleError({
            type: 'Timeout Error (XHR)',
            message: 'Request timed out',
            details: `Request to ${method} ${url} timed out.`,
            url,
            method,
          });
        };

        return originalSend.apply(this, args);
      };

      return xhr;
    };
  }

  handleError(errorInfo) {
    console.error('Webex SDK Error:', errorInfo);

    // Enhance error info by extracting tracking IDs from message content
    const enhancedErrorInfo = this.enhanceErrorInfo(errorInfo);

    this.showErrorModal(enhancedErrorInfo);
  }

  enhanceErrorInfo(errorInfo) {
    const enhanced = {...errorInfo};

    // Extract tracking ID from error message if not already present
    if (!enhanced.trackingId && errorInfo.message) {
      const trackingIdPatterns = [
        /TrackingId\s*=\s*([^,)]+)/i,
        /WEBEX_TRACKING_ID:\s*([^\s,]+)/i,
        /webex-js-sdk_[a-f0-9-]+_\d+/i,
        /tracking[_-]?id[:\s]*([a-f0-9-]+)/i,
      ];

      for (const pattern of trackingIdPatterns) {
        const match = errorInfo.message.match(pattern);
        if (match) {
          const [fullMatch, group1] = match;
          enhanced.trackingId = group1 || fullMatch;
          break;
        }
      }
    }

    // Extract tracking ID from error details if not found yet
    if (!enhanced.trackingId && errorInfo.details) {
      const detailsText =
        typeof errorInfo.details === 'string'
          ? errorInfo.details
          : JSON.stringify(errorInfo.details);

      const match = detailsText.match(/WEBEX_TRACKING_ID:\s*([^\s,]+)/i);
      if (match) {
        const [, trackingId] = match;
        enhanced.trackingId = trackingId;
      }
    }

    // Extract tracking ID from stack trace if not found yet
    if (!enhanced.trackingId && errorInfo.stack) {
      const match = errorInfo.stack.match(/webex-js-sdk_[a-f0-9-]+_\d+/i);
      if (match) {
        const [trackingId] = match;
        enhanced.trackingId = trackingId;
      }
    }

    // Clean up the error message by removing embedded tracking ID info
    if (enhanced.trackingId && enhanced.message) {
      enhanced.message = enhanced.message
        .replace(
          /\(url\s*=\s*[^,)]+,\s*request\/response\s+TrackingId\s*=\s*[^,)]+(?:,\s*error\s*=\s*'[^']*')?\)/i,
          ''
        )
        .replace(/POST\s+https:\/\/[^\s]+\s*WEBEX_TRACKING_ID:\s*[^\s]+/i, '')
        .replace(/\s+WEBEX_TRACKING_ID:\s*[^\s]+/i, '')
        .trim();

      // If message is now too short, create a better one
      if (enhanced.message.length < 10) {
        enhanced.message = `HTTP ${enhanced.status || '401'} ${
          enhanced.statusText || 'Unauthorized'
        }`;
      }
    }

    // Parse structured error details from Webex SDK errors
    if (errorInfo.message && errorInfo.message.includes('Error creating registration')) {
      const errorMatch = errorInfo.message.match(/error\s*=\s*'([^']+)'/i);
      if (errorMatch) {
        const [, errorDetail] = errorMatch;
        enhanced.details = errorDetail;
        enhanced.message = 'Registration Failed - User Not Authorized';
      }
    }

    return enhanced;
  }

  createModal() {
    // Remove existing modal if present
    const existingModal = document.getElementById(this.modalId);
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div id="${this.modalId}" class="webex-error-modal">
        <div class="webex-error-modal-overlay"></div>
        <div class="webex-error-modal-content">
          <div class="webex-error-modal-header">
            <h3 class="webex-error-modal-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span class="error-type">Error</span>
            </h3>
            <button class="webex-error-modal-close">&times;</button>
          </div>
          <div class="webex-error-modal-body">
            <div class="error-message"></div>
            <div class="error-details"></div>
            <div class="error-tracking-id"></div>
            <div class="error-technical-details">
              <button class="toggle-technical-details">Show Technical Details</button>
              <div class="technical-details-content" style="display: none;"></div>
            </div>
          </div>
          <div class="webex-error-modal-footer">
            <button class="webex-error-modal-btn webex-error-modal-btn-secondary" id="copy-error">Copy Error</button>
            <button class="webex-error-modal-btn webex-error-modal-btn-primary" id="close-error">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.setupModalEventListeners();
  }

  setupModalEventListeners() {
    const modal = document.getElementById(this.modalId);
    const closeBtn = modal.querySelector('.webex-error-modal-close');
    const closeFooterBtn = modal.querySelector('#close-error');
    const copyBtn = modal.querySelector('#copy-error');
    const toggleBtn = modal.querySelector('.toggle-technical-details');
    const overlay = modal.querySelector('.webex-error-modal-overlay');

    const closeModal = () => {
      modal.style.display = 'none';
    };

    closeBtn.addEventListener('click', closeModal);
    closeFooterBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    copyBtn.addEventListener('click', () => {
      const errorText = modal.querySelector('.technical-details-content').textContent;
      navigator.clipboard.writeText(errorText).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Error';
        }, 2000);
      });
    });

    toggleBtn.addEventListener('click', () => {
      const content = modal.querySelector('.technical-details-content');
      const isVisible = content.style.display !== 'none';
      content.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? 'Show Technical Details' : 'Hide Technical Details';
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'block') {
        closeModal();
      }
    });
  }

  showErrorModal(errorInfo) {
    const modal = document.getElementById(this.modalId);

    // Update modal content
    modal.querySelector('.error-type').textContent = errorInfo.type || 'Error';
    modal.querySelector('.error-message').textContent =
      errorInfo.message || 'An unexpected error occurred';

    // Handle details
    const detailsEl = modal.querySelector('.error-details');
    if (errorInfo.details) {
      detailsEl.innerHTML = `<div class="error-details-content">${this.formatErrorDetails(
        errorInfo.details
      )}</div>`;
      detailsEl.style.display = 'block';
    } else {
      detailsEl.style.display = 'none';
    }

    // Handle tracking ID
    const trackingEl = modal.querySelector('.error-tracking-id');
    if (errorInfo.trackingId) {
      trackingEl.innerHTML = `<div class="tracking-id"><strong>Tracking ID:</strong> <code>${errorInfo.trackingId}</code></div>`;
      trackingEl.style.display = 'block';
    } else {
      trackingEl.style.display = 'none';
    }

    // Handle technical details
    const technicalDetails = this.formatTechnicalDetails(errorInfo);
    modal.querySelector('.technical-details-content').textContent = technicalDetails;

    // Show modal
    modal.style.display = 'block';
  }

  formatErrorDetails(details) {
    if (typeof details === 'string') {
      return `<p>${this.escapeHtml(details)}</p>`;
    }

    return `<pre>${this.escapeHtml(JSON.stringify(details, null, 2))}</pre>`;
  }

  formatTechnicalDetails(errorInfo) {
    const details = [];

    details.push(`Type: ${errorInfo.type || 'Unknown'}`);
    details.push(`Message: ${errorInfo.message || 'No message'}`);

    if (errorInfo.status) details.push(`Status: ${errorInfo.status} ${errorInfo.statusText || ''}`);
    if (errorInfo.url) details.push(`URL: ${errorInfo.method || 'GET'} ${errorInfo.url}`);
    if (errorInfo.filename)
      details.push(`File: ${errorInfo.filename}:${errorInfo.line}:${errorInfo.column}`);
    if (errorInfo.trackingId) details.push(`Tracking ID: ${errorInfo.trackingId}`);
    if (errorInfo.stack) details.push(`Stack Trace:\n${errorInfo.stack}`);

    details.push(`Timestamp: ${new Date().toISOString()}`);
    details.push(`User Agent: ${navigator.userAgent}`);

    return details.join('\n');
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;

    return div.innerHTML;
  }

  addStyles() {
    // Remove existing styles if present
    const existingStyles = document.getElementById('webex-error-modal-styles');
    if (existingStyles) {
      existingStyles.remove();
    }

    const styles = `
      <style id="webex-error-modal-styles">
        .webex-error-modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }

        .webex-error-modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
        }

        .webex-error-modal-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow: hidden;
          animation: modalSlideIn 0.3s ease-out;
        }

        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        .webex-error-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 16px;
          border-bottom: 1px solid #e5e7eb;
          background: #fef2f2;
        }

        .webex-error-modal-title {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #dc2626;
        }

        .webex-error-modal-title svg {
          color: #dc2626;
        }

        .webex-error-modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #6b7280;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .webex-error-modal-close:hover {
          background: #f3f4f6;
          color: #374151;
        }

        .webex-error-modal-body {
          padding: 24px;
          max-height: 50vh;
          overflow-y: auto;
        }

        .error-message {
          font-size: 16px;
          font-weight: 500;
          color: #111827;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .error-details-content {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #374151;
          line-height: 1.5;
        }

        .error-details-content pre {
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .tracking-id {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .tracking-id code {
          background: #dbeafe;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 13px;
        }

        .error-technical-details {
          margin-top: 16px;
        }

        .toggle-technical-details {
          background: none;
          border: 1px solid #d1d5db;
          color: #374151;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .toggle-technical-details:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .technical-details-content {
          background: #1f2937;
          color: #f9fafb;
          padding: 16px;
          border-radius: 6px;
          margin-top: 12px;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
          max-height: 200px;
          overflow-y: auto;
        }

        .webex-error-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px 20px;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .webex-error-modal-btn {
          padding: 10px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 36px;
          line-height: 1;
        }

        .webex-error-modal-btn-primary {
          background: #2563eb;
          color: white;
        }

        .webex-error-modal-btn-primary:hover {
          background: #1d4ed8;
        }

        .webex-error-modal-btn-secondary {
          background: white;
          color: #374151;
          border-color: #d1d5db;
        }

        .webex-error-modal-btn-secondary:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        @media (max-width: 640px) {
          .webex-error-modal-content {
            width: 95%;
            max-height: 90vh;
          }
          
          .webex-error-modal-header,
          .webex-error-modal-body,
          .webex-error-modal-footer {
            padding-left: 16px;
            padding-right: 16px;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Public method to manually show an error
  showError(errorInfo) {
    this.handleError(errorInfo);
  }

  hideWebpackOverlay() {
    // Hide existing webpack overlay if present
    const hideOverlay = () => {
      const webpackOverlay = document.getElementById('webpack-dev-server-client-overlay-div');
      if (webpackOverlay) {
        webpackOverlay.style.display = 'none';
      }

      // Also hide React error overlay if present
      const reactOverlay = document.querySelector('[data-react-error-overlay]');
      if (reactOverlay) {
        reactOverlay.style.display = 'none';
      }

      // Hide any other common error overlays
      const errorOverlays = document.querySelectorAll(
        '[id*="overlay"], [class*="overlay"][style*="position: fixed"]'
      );
      errorOverlays.forEach((overlay) => {
        if (overlay.id !== this.modalId && overlay.style.zIndex > 1000) {
          overlay.style.display = 'none';
        }
      });
    };

    // Hide immediately
    hideOverlay();

    // Watch for webpack overlay being added dynamically
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (
              node.id === 'webpack-dev-server-client-overlay-div' ||
              node.hasAttribute('data-react-error-overlay') ||
              (node.style && node.style.position === 'fixed' && node.style.zIndex > 1000)
            ) {
              node.style.display = 'none';
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also hide on interval as backup
    setInterval(hideOverlay, 1000);
  }

  // Public method to test the error modal
  testModal() {
    this.showError({
      type: 'Test Error',
      message: '401 Unauthorized - Authentication failed',
      details:
        'The access token may have expired or be invalid. Please refresh your authentication.',
      trackingId: 'webex-js-sdk_98150c82-a4cf-4970-af9f-89f581c8696c_3',
      status: 401,
      statusText: 'Unauthorized',
      url: 'https://wdm.gov.ciscospark.com/wdm/api/v1/devices',
      method: 'POST',
    });
  }
}

// Create and export a singleton instance
const errorHandler = new ErrorHandler();

// Make it globally accessible for manual error reporting
window.WebexErrorHandler = errorHandler;

export default errorHandler;
