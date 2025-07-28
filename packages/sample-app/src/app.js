/* eslint-disable require-jsdoc */
import Webex from 'webex';
import './shared/errorHandler'; // Initialize global error handling

// Initialize Webex
const webex = new Webex();

// Track loaded CSS files
let loadedStylesheets = [];

// Function to load CSS dynamically
function loadCSS(href, id) {
  return new Promise((resolve, reject) => {
    // Remove existing stylesheet with same id
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = href;
    link.id = id;

    link.onload = () => resolve();
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));

    document.head.appendChild(link);
    loadedStylesheets.push(id);
  });
}

// Function to remove all route CSS
function clearRouteCSS() {
  loadedStylesheets.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
    }
  });
  loadedStylesheets = [];
}

// Route loading functions
const routes = {
  calling: () => import('./calling/app'),
  'plugin-encryption': () => import('./plugin-encryption/app'),
  'contact-center': () => import('./contact-center/app'),
  'browser-socket': () => import('./browser-socket/app'),
  'browser-read-status': () => import('./browser-read-status/app'),
  'browser-plugin-meetings': () => import('./browser-plugin-meetings/app'),
  'browser-auth': () => import('./browser-auth/app'),
};

// Function to load route content
async function loadRoute(routeName) {
  const app = document.getElementById('app');

  if (routeName === 'home') {
    // Clear any route-specific CSS
    clearRouteCSS();

    // Reset app container styles
    app.style.cssText = '';
    app.className = '';

    app.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 40px 20px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #333; font-size: 2.5rem; margin-bottom: 16px;">Webex JS SDK Sample App</h1>
          <p style="color: #666; font-size: 1.1rem; margin-bottom: 8px;">App is running successfully!</p>
          <p style="color: #666; font-size: 1rem;">Webex instance: <span style="color: ${
            webex ? '#28a745' : '#dc3545'
          }; font-weight: bold;">${webex ? 'Created ✓' : 'Failed ✗'}</span></p>
        </div>
        
        <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 32px;">
          <h2 style="color: #333; font-size: 1.5rem; margin-bottom: 24px; text-align: center;">Available Sample Routes</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px;">
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('calling')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">📞 Calling</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">WebRTC calling functionality with audio/video calls, DTMF, and call management features.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('plugin-encryption')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">🔐 Plugin Encryption</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">End-to-end encryption capabilities for secure communications.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('contact-center')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">🏢 Contact Center</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">Contact center integration and customer service features.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('browser-socket')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">🔌 Browser Socket</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">WebSocket connection handling and real-time communication.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('browser-read-status')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">📖 Browser Read Status</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">Message read status and delivery confirmation features.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('browser-plugin-meetings')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">🎥 Browser Plugin Meetings</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">Meeting functionality with video conferencing and collaboration tools.</p>
            </div>
            
            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; transition: all 0.3s ease; cursor: pointer;" onclick="loadRoute('browser-auth')" onmouseover="this.style.borderColor='#007acc'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e0e0'; this.style.transform='translateY(0)'">
              <h3 style="color: #007acc; margin: 0 0 8px 0; font-size: 1.2rem;">🔑 Browser Auth</h3>
              <p style="color: #666; margin: 0; font-size: 0.9rem;">Authentication and authorization flow demonstrations.</p>
            </div>
            
          </div>
          
          <div style="text-align: center; padding-top: 24px; border-top: 1px solid #e0e0e0;">
            <p style="color: #888; font-size: 0.9rem; margin: 0 0 16px 0;">Click on any card above to explore the sample implementations</p>
            <button onclick="window.WebexErrorHandler?.testModal()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; margin-right: 8px;">Test Error Modal</button>
            <button onclick="fetch('/nonexistent-endpoint')" style="background: #7c2d12; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Test HTTP Error</button>
          </div>
        </div>
      </div>
    `;

    return;
  }

  if (routes[routeName]) {
    try {
      // Show loading indicator
      app.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; font-family: Arial, sans-serif;">
          <div style="position: relative; width: 60px; height: 60px; margin-bottom: 24px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #007acc; border-radius: 50%; width: 60px; height: 60px; animation: spin 1s linear infinite;"></div>
          </div>
          <h3 style="color: #333; margin: 0 0 8px 0; font-size: 1.2rem;">Loading ${routeName
            .replace('-', ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase())} Route</h3>
          <p style="color: #666; margin: 0; font-size: 0.9rem;">Setting up the sample environment...</p>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </div>
      `;

      // Clear previous route CSS
      clearRouteCSS();

      // Reset app container styles first
      app.style.cssText = '';
      app.className = '';

      // Load route-specific CSS first
      let cssPath = '';
      switch (routeName) {
        case 'calling':
          cssPath = './calling/style.css';
          break;
        case 'plugin-encryption':
          cssPath = './plugin-encryption/style.css';
          break;
        case 'contact-center':
          cssPath = './contact-center/style.css';
          break;
        case 'browser-plugin-meetings':
          cssPath = './browser-plugin-meetings/style.css';
          break;
        default:
          // No CSS file for this route
          break;
      }

      // Load CSS if it exists
      if (cssPath) {
        try {
          await loadCSS(cssPath, `${routeName}-styles`);

          // Apply route-specific container styles
          switch (routeName) {
            case 'calling':
              app.style.cssText = `
                background-color: #eee;
                font-family: sans-serif;
                font-size: 15px;
                min-height: calc(100vh - 40px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
              `;
              break;
            case 'plugin-encryption':
              app.style.cssText = `
                background-color: #f5f5f5;
                font-family: Arial, sans-serif;
                min-height: calc(100vh - 40px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
              `;
              break;
            case 'contact-center':
              app.style.cssText = `
                background-color: #f0f0f0;
                font-family: sans-serif;
                min-height: calc(100vh - 40px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
              `;
              break;
            case 'browser-plugin-meetings':
              app.style.cssText = `
                background-color: #f8f8f8;
                font-family: Arial, sans-serif;
                min-height: calc(100vh - 40px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
              `;
              break;
            default:
              app.style.cssText = `
                background-color: #ffffff;
                font-family: Arial, sans-serif;
                min-height: calc(100vh - 40px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
              `;
              break;
          }
        } catch (cssError) {
          console.warn(`Could not load CSS for ${routeName}:`, cssError);
        }
      }

      // Dynamically load the route's HTML content
      let htmlContent = '';

      switch (routeName) {
        case 'calling': {
          const callingHtml = await fetch('./calling/index.html');
          htmlContent = await callingHtml.text();
          break;
        }
        case 'plugin-encryption': {
          const encryptionHtml = await fetch('./plugin-encryption/index.html');
          htmlContent = await encryptionHtml.text();
          break;
        }
        case 'contact-center': {
          const contactCenterHtml = await fetch('./contact-center/index.html');
          htmlContent = await contactCenterHtml.text();
          break;
        }
        case 'browser-plugin-meetings': {
          const meetingsHtml = await fetch('./browser-plugin-meetings/index.html');
          htmlContent = await meetingsHtml.text();
          break;
        }
        case 'browser-socket': {
          const socketHtml = await fetch('./browser-socket/index.html');
          htmlContent = await socketHtml.text();
          break;
        }
        case 'browser-read-status': {
          const readStatusHtml = await fetch('./browser-read-status/index.html');
          htmlContent = await readStatusHtml.text();
          break;
        }
        case 'browser-auth': {
          const browserAuthHtml = await fetch('./browser-auth/index.html');
          htmlContent = await browserAuthHtml.text();
          break;
        }
        default:
          htmlContent = `
            <div style="text-align: center; padding: 40px;">
              <h2>${routeName.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Route</h2>
              <p>This sample route is being prepared.</p>
              <button onclick="loadRoute('home')" style="background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 1rem;">Back to Home</button>
            </div>
          `;
      }

      // Extract body content from the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const bodyContent = doc.body.innerHTML;

      app.innerHTML = `
        <div style="width: 100%; max-width: 1400px; margin: 0 auto;">
          <div style="margin-bottom: 20px;">
            <button onclick="loadRoute('home')" style="background: #007acc; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 8px;">
              ← Back to Home
            </button>
          </div>
          ${bodyContent}
        </div>
      `;

      // Wait for DOM to be fully rendered before loading JavaScript
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 100);
        });
      });

      // Load JavaScript - use import for all routes
      await routes[routeName]();
    } catch (error) {
      console.error(`Error loading route ${routeName}:`, error);
      app.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 40px 20px; text-align: center; font-family: Arial, sans-serif;">
          <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 32px;">
            <h2 style="color: #dc3545; margin: 0 0 16px 0;">⚠️ Error Loading Route</h2>
            <p style="color: #666; margin: 0 0 24px 0;">Could not load <strong>${routeName}</strong></p>
            <div style="background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 16px; margin: 0 0 24px 0; text-align: left;">
              <code style="color: #e83e8c; font-size: 0.9rem;">${error.message}</code>
            </div>
            <button onclick="loadRoute('home')" style="background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 1rem;">
              Back to Home
            </button>
          </div>
        </div>
      `;
    }
  } else {
    app.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; font-family: Arial, sans-serif;">
        <h2 style="color: #333;">Route Not Found</h2>
        <p style="color: #666;">Route "${routeName}" does not exist.</p>
        <button onclick="loadRoute('home')" style="background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 1rem;">Back to Home</button>
      </div>
    `;
  }
}

// Make loadRoute available globally
window.loadRoute = loadRoute;

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', function () {
  loadRoute('home');
});
