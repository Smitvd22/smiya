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

// More robust handling for stream-related functions
const originalUpdateReadableListening = window.updateReadableListening;
window.updateReadableListening = function(stream) {
  try {
    if (!stream || !stream._readableState) return;
    if (typeof originalUpdateReadableListening === 'function') {
      originalUpdateReadableListening(stream);
    }
  } catch (err) {
    console.warn('Suppressed stream error:', err.message);
  }
};

const originalEmitReadable = window.emitReadable_;
window.emitReadable_ = function(stream) {
  try {
    if (!stream || !stream._readableState) return;
    if (typeof originalEmitReadable === 'function') {
      originalEmitReadable(stream);
    }
  } catch (err) {
    console.warn('Suppressed stream error:', err.message);
  }
};

// Safe setTimeout implementation
const originalSetTimeout = window.setTimeout;
window.setTimeout = function(callback, delay) {
  if (typeof callback === 'function') {
    const wrappedCallback = function() {
      try {
        callback();
      } catch (e) {
        // Check if this is the stream error we're looking for
        if (e && e.message && e.message.includes('_readableState')) {
          console.warn('Suppressed stream error in setTimeout');
          return;
        }
        throw e;
      }
    };
    return originalSetTimeout(wrappedCallback, delay);
  }
  return originalSetTimeout(callback, delay);
};

export default window.process;