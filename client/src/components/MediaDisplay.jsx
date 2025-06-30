import React, { useState, useEffect, useRef } from 'react';
import '../styles/MediaDisplay.css';

const MediaDisplay = ({ media }) => {
  // Initialize with true for immediate loading in message contexts
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Initialize isVisible to true so we immediately start loading
  const [isVisible, setIsVisible] = useState(true);
  // Reference to hold the container element
  const containerRef = useRef(null);
  const mediaUrlRef = useRef(media?.url || ''); // Initialize with current URL if available

  // Effect when media changes - using a ref to avoid unnecessary reloads
  useEffect(() => {
    if (!media || !media.url) {
      console.error("Media data missing required URL property:", media);
      setLoadError(true);
      setIsLoading(false);
      return;
    }
    
    // Only update if the media has meaningfully changed
    // This prevents reloading when a parent component re-renders due to unrelated state changes
    if (mediaUrlRef.current !== media.url && 
        (!mediaUrlRef.current.split('?')[0] || 
         mediaUrlRef.current.split('?')[0] !== media.url.split('?')[0] || 
         media.timestamp)) {
      
      console.log("Media URL changed or timestamp updated, resetting loading state");
      
      // Store the new URL with timestamp if present
      mediaUrlRef.current = media.url;
      
      // Reset states
      setLoadError(false);
      setIsLoading(true);
    }
  }, [media]);

  // Modified Intersection Observer that only affects visibility, not loading
  useEffect(() => {
    if (!media || !media.url) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          console.log("Media element became visible:", media.url);
          setIsVisible(true);
        } else {
          // We still track visibility for potential optimizations
          // but we don't stop loading or unload media
          console.log("Media element no longer visible:", media.url);
          // Don't set isVisible to false to avoid reloading when scrolling back
        }
      },
      { 
        threshold: 0.1,
        rootMargin: "200px" // Increased margin to load earlier before becoming visible
      }
    );
    
    // Save the current value of containerRef to a local variable to use in cleanup
    const currentContainer = containerRef.current;
    
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    
    return () => {
      // Use the saved reference in cleanup to avoid the React hooks warning
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
      observer.disconnect();
    };
  }, [media]);

  // Download media function
  const downloadMedia = () => {
    if (!media || !media.url) return;
    
    const link = document.createElement('a');
    link.href = media.url;
    link.download = `download.${media.format || getFormatFromUrl(media.url)}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Helper function to extract format from URL if not provided
  const getFormatFromUrl = (url) => {
    if (!url) return 'unknown';
    const parts = url.split('.');
    return parts.length > 1 ? parts[parts.length - 1].split('?')[0] : 'unknown';
  };

  const handleMediaLoad = () => {
    console.log("Media loaded successfully:", media?.url);
    setIsLoading(false);
    setLoadError(false);
  };

  const handleMediaError = () => {
    console.error("Media load failed:", {
      url: media?.url,
      type: media?.resourceType,
      format: media?.format,
      status: "Check CORS, URL validity, and network status"
    });
    setIsLoading(false);
    setLoadError(true);
  };

  const retryLoading = () => {
    if (!media || !media.url) return;
    
    // Reset loading states
    setIsLoading(true);
    setLoadError(false);
    
    // Force re-render of the media element by adding a fresh timestamp to URL
    const baseUrl = media.url.split('?')[0];
    media.url = `${baseUrl}?t=${new Date().getTime()}`;
    mediaUrlRef.current = media.url; // Update the ref to match
    
    console.log("Retrying media load with URL:", media.url);
  };

  // Get optimized URL with Cloudinary transformations and cache busting
  const getOptimizedUrl = () => {
    if (!media || !media.url) return '';
    
    // Check if URL already has query parameters
    const baseUrl = media.url.includes('?') ? media.url.split('?')[0] : media.url;
    
    // Add appropriate transformations based on resource type
    let transformations = '';
    
    if (media.resourceType === 'image') {
      // Enhanced image transformations for faster loading
      // Format auto for WebP/AVIF where supported
      // Quality auto for optimal compression
      // Width auto for responsive sizing
      transformations = 'q_auto:good,f_auto,w_auto,dpr_auto';
      
      // Add small thumbnail for immediate display while high quality loads
      if (baseUrl.includes('cloudinary.com')) {
        transformations += ',e_blur:1000,w_50,h_50,c_scale/e_grayscale';
      }
    } 
    else if (media.resourceType === 'video') {
      // Video optimizations
      transformations = 'q_auto:good,vc_auto,vs_25';
    }
    else {
      // Default quality optimization
      transformations = 'q_auto:good';
    }
    
    // Add a permanent cache key based on message ID or public ID if available
    // This ensures the URL doesn't change on every render but does change when content changes
    const cacheKey = media.messageId || media.publicId || media.timestamp || new Date().getTime();
    
    return `${baseUrl}?${transformations}&_cacheKey=${cacheKey}`;
  };

  const renderMedia = () => {
    // Always display a container even if media data is invalid
    if (!media || !media.url) {
      return (
        <div className="media-error">
          <p>Media attachment unavailable</p>
          <span className="error-details">Missing media URL</span>
        </div>
      );
    }
    
    // We've simplified the condition checks:
    // No more waiting for visibility - media should load immediately
    // If it's not visible in the DOM, it won't render anyway

    // Normalize resource type to handle various formats
    const resourceType = (media.resourceType || '').toLowerCase();
    const optimizedUrl = getOptimizedUrl();
    
    // Handle different media types with expanded cases
    if (resourceType.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(resourceType)) {
      return (
        <div className="image-container">
          {isLoading && <div className="media-loading"><div className="spinner"></div> Loading image...</div>}
          {loadError && (
            <div className="media-error">
              <p>Failed to load image</p>
              <button onClick={retryLoading}>Retry</button>
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="open-link">
                Open in new tab
              </a>
            </div>
          )}
          <img 
            src={optimizedUrl}
            alt="Shared content" 
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            style={{ display: isLoading || loadError ? 'none' : 'block' }}
            loading="eager" 
            decoding="async"
            fetchpriority="high"
            key={media.timestamp || new Date().getTime()} // Add key to force re-render
          />
        </div>
      );
    } 
    else if (resourceType.includes('video') || ['mp4', 'webm', 'mov', 'avi'].includes(resourceType)) {
      return (
        <div className="video-container">
          {isLoading && <div className="media-loading"><div className="spinner"></div> Loading video...</div>}
          {loadError && (
            <div className="media-error">
              <p>Failed to load video</p>
              <button onClick={retryLoading}>Retry</button>
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="open-link">
                Open in new tab
              </a>
            </div>
          )}
          <video 
            controls 
            src={optimizedUrl}
            onLoadedData={handleMediaLoad}
            onCanPlayThrough={handleMediaLoad} // Added this event to mark as loaded when can play
            onError={handleMediaError}
            style={{ display: isLoading || loadError ? 'none' : 'block' }}
            preload="auto"
            autoPlay={false}
            muted={true} // Initially muted to allow autoplay if desired
            playsInline
            key={media.timestamp || new Date().getTime()} // Add key to force re-render
          />
        </div>
      );
    }
    else if (resourceType.includes('audio') || ['mp3', 'wav', 'ogg', 'aac'].includes(resourceType)) {
      // Audio container...same pattern
      return (
        <div className="audio-container">
          {isLoading && <div className="media-loading"><div className="spinner"></div> Loading audio...</div>}
          {loadError && (
            <div className="media-error">
              <p>Failed to load audio</p>
              <button onClick={retryLoading}>Retry</button>
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="open-link">
                Open in new tab
              </a>
            </div>
          )}
          <audio 
            controls 
            src={optimizedUrl}
            onLoadedData={handleMediaLoad}
            onCanPlayThrough={handleMediaLoad} // Added this event to mark as loaded when can play
            onError={handleMediaError}
            style={{ display: isLoading || loadError ? 'none' : 'block' }}
            preload="auto"
            key={media.timestamp || new Date().getTime()} // Add key to force re-render
          />
        </div>
      );
    }
    else {
      // For unknown types, provide a basic link
      return (
        <div className="unknown-media">
          <p>Unsupported media type: {media.resourceType || 'unknown'}</p>
          <a href={media.url} target="_blank" rel="noopener noreferrer" className="download-link">
            Open media in new tab
          </a>
        </div>
      );
    }
  };

  return (
    <div className="media-display" ref={containerRef}>
      {renderMedia()}
      {!isLoading && !loadError && isVisible && media?.url && (
        <button className="download-button" onClick={downloadMedia}>
          Download
        </button>
      )}
    </div>
  );
};

export default MediaDisplay;