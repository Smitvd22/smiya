import React, { useEffect } from 'react';
import '../styles/VideoCall.css';

const VideoCallInterface = ({
  myVideo,
  userVideo,
  stream,
  isAudioEnabled,
  isVideoEnabled,
  toggleAudio,
  toggleVideo,
  endCallHandler,
  callError,
  callState,
  callerInfo,
  answerCall,
  rejectCall,
  connectionStatus,
  socketConnected,
  streamInitialized,
  connectionQuality,
}) => {
  useEffect(() => {
    if (userVideo?.current) {
      console.log("UserVideo element dimensions:", {
        offsetWidth: userVideo.current.offsetWidth,
        offsetHeight: userVideo.current.offsetHeight,
        clientWidth: userVideo.current.clientWidth,
        clientHeight: userVideo.current.clientHeight
      });
    }
    
    if (myVideo?.current) {
      console.log("MyVideo element dimensions:", {
        offsetWidth: myVideo.current.offsetWidth,
        offsetHeight: myVideo.current.offsetHeight
      });
    }
  }, [userVideo, myVideo]);

  const renderUserProfile = () => {
    if (callState === 'calling') {
      return (
        <div className="user-profile">
          {callerInfo?.profileImage ? (
            <img 
              src={callerInfo.profileImage} 
              alt={callerInfo?.username || 'User'} 
              className="profile-image"
            />
          ) : (
            <div className="profile-image" style={{ 
              backgroundColor: '#555', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '36px',
              color: 'white'
            }}>
              {(callerInfo?.username || 'User').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="profile-name">{callerInfo?.username || 'User'}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="video-call-container active">
      {callError && <div className="call-error">{callError}</div>}

      {/* Connection status indicators */}
      {!socketConnected && (
        <div className="connection-indicator error">
          Server connection lost - reconnecting...
        </div>
      )}

      {socketConnected && connectionStatus === 'connecting' && (
        <div className="connection-indicator warning">
          Establishing connection...
        </div>
      )}

      {socketConnected && connectionStatus === 'connected' && (
        <div className="connection-indicator success">
          Call connected
        </div>
      )}

      {/* Connection quality indicator */}
      {connectionQuality !== 'unknown' && callState === 'active' && (
        <div className={`connection-quality ${connectionQuality}`}>
          <span className="quality-indicator"></span>
          <span className="quality-text">
            {connectionQuality === 'good' ? 'Good connection' : 
             connectionQuality === 'fair' ? 'Fair connection' : 
             'Poor connection'}
          </span>
        </div>
      )}

      <div className="videos-container">
        {/* Main video container */}
        <div className="video-player">
          {callState === 'active' ? (
            userVideo?.current?.srcObject ? (
              <video
                ref={userVideo}
                className="user-video"
                autoPlay
                playsInline
                onLoadedMetadata={() => {
                  console.log("User video loaded metadata");
                  if (userVideo.current) {
                    // Check if we have tracks in the stream
                    const hasVideoTracks = userVideo.current.srcObject && 
                                           userVideo.current.srcObject.getVideoTracks &&
                                           userVideo.current.srcObject.getVideoTracks().length > 0;
                    
                    console.log(`Remote video has ${hasVideoTracks ? 'video tracks' : 'no video tracks'}`);
                    
                    userVideo.current.play().catch(e => {
                      console.error("Error playing remote video after metadata loaded:", e);
                      // Add retry mechanism
                      setTimeout(() => {
                        if (userVideo.current) {
                          userVideo.current.play().catch(err => 
                            console.warn("Retry play also failed:", err));
                        }
                      }, 1000);
                    });
                  }
                }}
                onPlay={() => console.log("Remote video started playing successfully")}
                onError={(e) => console.error("Video element error:", e.target.error)}
              />
            ) : (
              <div className="video-placeholder">Remote user's camera is off</div>
            )
          ) : (
            <div className="video-placeholder"></div>
          )}
          
          {callState === 'active' && (
            <div className="video-label">{callerInfo?.username || 'User'}</div>
          )}
          
          {/* Render caller profile during 'calling' state */}
          {renderUserProfile()}
          
          {/* My video as picture-in-picture - now rectangular and at bottom right */}
          {stream && (
            <div className="my-video-container">
              <video 
                playsInline 
                muted 
                ref={myVideo} 
                autoPlay 
                className="my-video"
                onLoadedMetadata={() => {
                  console.log("My video loaded metadata");
                  if (myVideo.current) {
                    myVideo.current.play().catch(e => 
                      console.error("Error playing local video after metadata loaded:", e));
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {callState === 'calling' && (
        <div className="call-status">
          <h3>Calling...</h3>
          <p>Waiting for answer</p>
        </div>
      )}

      {/* Call controls */}
      {(callState === 'active' || callState === 'calling') && (
        <div className="call-controls">
          <button
            className={`toggle-audio ${!isAudioEnabled ? 'disabled' : ''}`}
            onClick={toggleAudio}
            aria-label={isAudioEnabled ? 'Mute' : 'Unmute'}
          >
            {isAudioEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button
            className={`toggle-video ${!isVideoEnabled ? 'disabled' : ''}`}
            onClick={toggleVideo}
            aria-label={isVideoEnabled ? 'Hide Video' : 'Show Video'}
          >
            {isVideoEnabled ? 'Hide Video' : 'Show Video'}
          </button>
          <button 
            className="end-call" 
            onClick={endCallHandler}
            aria-label={callState === 'calling' ? 'Cancel Call' : 'End Call'}
          >
            {callState === 'calling' ? 'Cancel' : 'End Call'}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCallInterface;