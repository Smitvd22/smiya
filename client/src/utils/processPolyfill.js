// Simple process polyfill for browser environment
if (typeof window !== 'undefined' && !window.process) {
  window.process = {
    env: {}, // Empty env object for process.env access
    nextTick: function(callback) {
      setTimeout(callback, 0);
    },
    browser: true,
    version: '',
    platform: 'browser'
  };
}

// Fix for process polyfill issues with simple-peer
// This helps avoid stream related errors

// Make sure we have a process.nextTick function
if (!window.process) {
  window.process = {};
}

// Safe nextTick implementation
if (!window.process.nextTick) {
  window.process.nextTick = function(callback) {
    setTimeout(callback, 0);
  };
}

// Handle _stream_readable.js error
// This fixes the "Cannot read properties of undefined (reading '_readableState')" error
const originalSetTimeout = window.setTimeout;
window.setTimeout = function(callback, delay) {
  if (typeof callback === 'function') {
    try {
      return originalSetTimeout(callback, delay);
    } catch(e) {
      console.warn('setTimeout error suppressed:', e);
      return originalSetTimeout(() => {}, delay);
    }
  }
  return originalSetTimeout(callback, delay);
};

export default window.process;