import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../styles/MediaUpload.css';

const MediaUpload = ({ onUploadSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const pressTimerRef = useRef(null);
  const recordingChunksRef = useRef([]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  // Improved effect to properly handle video loading state
  useEffect(() => {
    // Check if video is actually loaded and playing
    const handleVideoLoad = () => {
      console.log("Camera video stream loaded successfully");
      // Make sure UI updates when video is actually playing
      if (videoRef.current && videoRef.current.readyState >= 2) {
        videoRef.current.classList.add('camera-loaded');
      }
    };

    if (showCapture && videoRef.current && streamRef.current) {
      // Store a reference to the current video element
      const currentVideo = videoRef.current;
      
      // Double-check that video element is properly connected to stream
      if (!currentVideo.srcObject) {
        currentVideo.srcObject = streamRef.current;
      }
      
      // Add event listener for when video can play
      currentVideo.addEventListener('loadeddata', handleVideoLoad);
      
      // Verify stream is active
      const tracks = streamRef.current.getVideoTracks();
      if (tracks.length > 0 && !tracks[0].enabled) {
        tracks[0].enabled = true;
      }
      
      return () => {
        // Use the stored reference in the cleanup function
        currentVideo.removeEventListener('loadeddata', handleVideoLoad);
      };
    }
  }, [showCapture]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Determine file type
    const fileType = selectedFile.type.split('/')[0];
    setMediaType(fileType);
    
    // Create preview
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    
    // Clean up preview URL when component unmounts
    return () => URL.createObjectURL(objectUrl);
  };

  const uploadToCloudinary = async () => {
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'auto');
    
    console.log("Cloud name:", process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
    console.log("Upload preset:", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    
    try {
      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        formData
      );
      
      onUploadSuccess({
        url: response.data.secure_url,
        publicId: response.data.public_id,
        resourceType: response.data.resource_type,
        format: response.data.format
      });
      
      // Clean up
      setFile(null);
      setPreviewUrl(null);
      setIsUploading(false);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      alert('Failed to upload media. Please try again.');
    }
  };

  const startCameraCapture = async () => {
    try {
      console.log("Starting camera capture...");
      setShowCapture(true);
      // Default to image type initially
      setMediaType('image');
      
      // Always use both video and audio constraints for the combined interface
      const constraints = { 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }, 
        audio: true 
      };
      
      console.log("Requesting user media with constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Stream obtained successfully");
      streamRef.current = stream;
      
      if (videoRef.current) {
        console.log("Setting video source object");
        videoRef.current.srcObject = stream;
        
        // Make sure the video element updates correctly
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          videoRef.current.play().catch(e => console.error("Error playing video:", e));
        };
      } else {
        console.error("Video ref not available");
      }
    } catch (err) {
      console.error('Media capture error:', err);
      alert('Could not access camera/microphone. Please check permissions.');
      // If we can't access camera, go back to file upload view
      setShowCapture(false);
      setMediaType(null);
    }
  };

  const startMediaCapture = async (type) => {
    if (type === 'audio') {
      try {
        // Only request audio for audio recording
        const constraints = { audio: true };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        setShowCapture(true);
        setMediaType('audio');
        
        // Start audio recording immediately
        const mediaRecorder = new MediaRecorder(stream);
        recordingChunksRef.current = [];
        
        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            recordingChunksRef.current.push(event.data);
          }
        });
        
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], "recording.webm", { type: 'audio/webm' });
          setFile(audioFile);
          setPreviewUrl(URL.createObjectURL(audioBlob));
          setShowCapture(false);
          setIsRecording(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        });
        
        // Start recording
        mediaRecorder.start();
        recorderRef.current = mediaRecorder;
        setIsRecording(true);
        
        // Start a timer to track recording duration
        setRecordingDuration(0);
        timerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
      } catch (err) {
        console.error('Audio capture error:', err);
        alert('Could not access microphone. Please check permissions.');
      }
    }
  };

  const handleCaptureButtonDown = () => {
    // Make sure the video is loaded before allowing capture
    if (!videoRef.current || videoRef.current.readyState < 2) {
      console.log("Camera not ready yet, ignoring capture attempt");
      return;
    }

    // Start a timer to detect if this is a long press (for video)
    pressTimerRef.current = setTimeout(() => {
      // It's a long press, start video recording
      setMediaType('video');
      startVideoRecording();
    }, 500); // 500ms threshold to determine a long press
  };

  const handleCaptureButtonUp = () => {
    // If video isn't ready, don't attempt to capture
    if (!videoRef.current || videoRef.current.readyState < 2) {
      console.log("Camera not ready yet, ignoring capture attempt");
      return;
    }
    
    // If press timer still exists, it was a short press (photo)
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
      
      // It was a short click, capture photo
      if (!isRecording) {
        console.log("Taking photo");
        capturePhoto();
      } else {
        // If already recording, stop the recording
        stopVideoRecording();
      }
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    
    try {
      const mediaRecorder = new MediaRecorder(streamRef.current);
      recordingChunksRef.current = [];
      
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });
      
      mediaRecorder.addEventListener("stop", () => {
        const videoBlob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const videoFile = new File([videoBlob], "recording.webm", { type: 'video/webm' });
        setFile(videoFile);
        setPreviewUrl(URL.createObjectURL(videoBlob));
        setShowCapture(false);
        setIsRecording(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      });
      
      // Start recording
      mediaRecorder.start();
      recorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      // Start a timer to track recording duration
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not start video recording');
    }
  };

  const stopVideoRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const capturePhoto = () => {
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    
    if (!video) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const imageFile = new File([blob], "capture.jpg", { type: 'image/jpeg' });
      console.log("Photo captured, switching to preview mode");
      setFile(imageFile);
      setPreviewUrl(URL.createObjectURL(blob));
      
      // Important: first stop media stream then update UI state
      stopMediaStream();
      // Ensure we're exiting the capture mode
      setShowCapture(false);
      setMediaType('image');
      
      // Add small delay to ensure state updates properly
      setTimeout(() => {
        console.log("Preview should now be visible");
      }, 100);
    }, 'image/jpeg');
  };

  const stopMediaStream = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  
  const cancel = () => {
    stopMediaStream();
    setFile(null);
    setPreviewUrl(null);
    setShowCapture(false);
    setIsRecording(false);
    setRecordingDuration(0);
    onCancel();
  };

  // Format seconds as MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="media-upload-container">
      {!showCapture ? (
        <div className="media-options">
          {!file && (
            <>
              <div className="media-buttons">
                <button type="button" onClick={() => fileInputRef.current.click()}>
                  Select File
                </button>
                <button type="button" onClick={startCameraCapture}>
                  Camera
                </button>
                <button type="button" onClick={() => startMediaCapture('audio')}>
                  Record Audio
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*,audio/*"
                style={{ display: 'none' }}
              />
            </>
          )}
          
          {file && (
            <div className="media-preview">
              {mediaType === 'image' && (
                <img src={previewUrl} alt="Preview" />
              )}
              {mediaType === 'video' && (
                <video src={previewUrl} controls />
              )}
              {mediaType === 'audio' && (
                <audio src={previewUrl} controls />
              )}
              <div className="action-buttons">
                <button 
                  onClick={uploadToCloudinary} 
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Send'}
                </button>
                <button onClick={cancel}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="media-capture">
          {mediaType !== 'audio' ? (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline
                className="camera-feed"
                style={{ display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'cover' }}
              />
              <div className="camera-loading" style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)',
                color: 'white',
                opacity: videoRef.current?.readyState >= 2 ? '0' : '1',
                transition: 'opacity 0.3s ease',
                visibility: videoRef.current?.readyState >= 2 ? 'hidden' : 'visible'
              }}>
                
              </div>
            </>
          ) : (
            <div className="audio-recording">
              <div className="audio-waveform">
                <div className="recording-dot"></div>
                <span>Recording Audio</span>
              </div>
            </div>
          )}
          
          {isRecording && (
            <div className="recording-indicator">
              <div className="recording-dot"></div>
              <span>{formatDuration(recordingDuration)}</span>
            </div>
          )}
          
          <div className="capture-instructions">
            {mediaType !== 'audio' 
              ? (!isRecording ? 'Tap for photo, hold for video' : 'Release to stop recording')
              : 'Recording audio... Press stop when finished'}
          </div>
          
          <div className="action-buttons">
            {mediaType !== 'audio' ? (
              <button 
                className="capture-button"
                onMouseDown={handleCaptureButtonDown}
                onMouseUp={handleCaptureButtonUp}
                onTouchStart={handleCaptureButtonDown}
                onTouchEnd={handleCaptureButtonUp}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: isRecording ? 'red' : '#2196f3',
                  border: '3px solid white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  marginTop: '10px'
                }}
              >
                {!isRecording ? '📷' : '⏺️'}
              </button>
            ) : (
              <button 
                className="stop-button"
                onClick={stopVideoRecording}
              >
                Stop Recording
              </button>
            )}
            <button onClick={cancel} className="cancel-button">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUpload;