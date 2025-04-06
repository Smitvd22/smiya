import React, { useState, useRef } from 'react';
import axios from 'axios';
import '../styles/MediaUpload.css';

const MediaUpload = ({ onUploadSuccess, onCancel }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

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
    return () => URL.revokeObjectURL(objectUrl);
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

  const startMediaCapture = async (type) => {
    try {
      let constraints = {};
      if (type === 'video') {
        constraints = { video: true, audio: true };
      } else if (type === 'audio') {
        constraints = { audio: true };
      } else {
        constraints = { video: true };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current && (type === 'video' || type === 'image')) {
        videoRef.current.srcObject = stream;
      }
      
      setShowCapture(true);
      setMediaType(type);
    } catch (err) {
      console.error('Media capture error:', err);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const captureMedia = () => {
    if (mediaType === 'audio') {
      // For audio, we need to use MediaRecorder API
      const mediaRecorder = new MediaRecorder(streamRef.current);
      const audioChunks = [];
      
      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });
      
      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], "recording.wav", { type: 'audio/wav' });
        setFile(audioFile);
        setPreviewUrl(URL.createObjectURL(audioBlob));
        stopMediaStream();
      });
      
      // Record for 5 seconds
      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 5000);
    } else {
      // For image or video frame capture
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const imageFile = new File([blob], "capture.jpg", { type: 'image/jpeg' });
        setFile(imageFile);
        setPreviewUrl(URL.createObjectURL(blob));
        stopMediaStream();
      }, 'image/jpeg');
    }
    
    setShowCapture(false);
  };

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };
  
  const cancel = () => {
    stopMediaStream();
    setFile(null);
    setPreviewUrl(null);
    setShowCapture(false);
    onCancel();
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
                <button type="button" onClick={() => startMediaCapture('image')}>
                  Take Photo
                </button>
                <button type="button" onClick={() => startMediaCapture('video')}>
                  Record Video
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
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            style={{ display: mediaType === 'audio' ? 'none' : 'block' }}
          />
          {mediaType === 'audio' && (
            <div className="audio-recording">
              <p>Recording audio...</p>
            </div>
          )}
          <div className="action-buttons">
            <button onClick={captureMedia}>
              {mediaType === 'audio' ? 'Stop Recording' : 'Capture'}
            </button>
            <button onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaUpload;