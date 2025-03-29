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

export default window.process;