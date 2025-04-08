import React, { useState, useEffect, useRef } from 'react';
import '../styles/MediaDisplay.css';

const MediaDisplay = ({ media }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  // Effect when media changes
  useEffect(() => {
    if (!media || !media.url) {
      console.error("Media data missing required URL property:", media);
      setLoadError(true);
      setIsLoading(false);
    } else {
      // Reset error state when valid media is provided
      setLoadError(false);
      setIsLoading(true);
    }
  }, [media]);

  // Lazy loading with Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

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
    
    setIsLoading(true);
    setLoadError(false);
    // Force re-render of the media element by adding timestamp to URL
    media.url = `${media.url.split('?')[0]}?t=${new Date().getTime()}`;
  };

  // Get optimized URL with Cloudinary transformations
  const getOptimizedUrl = () => {
    if (!media || !media.url) return '';
    
    // Check if URL already has query parameters
    const baseUrl = media.url.includes('?') ? media.url.split('?')[0] : media.url;
    
    // Add appropriate transformations based on resource type
    const transformations = media.resourceType === 'image' 
      ? 'q_auto,f_auto,w_500' 
      : 'q_auto';
      
    return `${baseUrl}?${transformations}`;
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
    
    if (!isVisible) return <div className="media-placeholder" style={{ minHeight: '150px' }}></div>;

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
          />
        </div>
      );
    } 
    // Remaining media type handling remains the same...
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
            onError={handleMediaError}
            style={{ display: isLoading || loadError ? 'none' : 'block' }}
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
            onError={handleMediaError}
            style={{ display: isLoading || loadError ? 'none' : 'block' }}
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