import React from 'react';
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
  connectionStatus,  // New prop
  socketConnected,   // New prop
}) => {
  return (
    <div className="video-call-container active">
      {callError && <div className="call-error">{callError}</div>}

      {/* Connection status indicators */}
      {connectionStatus === 'connected' && <div className="connection-indicator connected">Connected</div>}
      {connectionStatus === 'error' && <div className="connection-indicator error">Connection error</div>}
      {connectionStatus === 'initializing' && <div className="connection-indicator initializing">Initializing connection...</div>}
      {connectionStatus === 'connecting' && <div className="connection-indicator connecting">Connecting...</div>}
      {connectionStatus === 'reconnecting' && <div className="connection-indicator reconnecting">Attempting to reconnect...</div>}
      {!socketConnected && callState !== 'idle' && (
        <div className="connection-indicator error">
          Socket disconnected - call functionality limited
        </div>
      )}

      {callState === 'calling' && (
        <div className="call-status">
          <h3>Calling...</h3>
          <p>Waiting for answer</p>
          {/* <button className="end-call" onClick={endCallHandler}>Cancel</button> */}
        </div>
      )}

      <div className="videos-container">
        <div className="video-player my-video">
          {stream ? (
            <video playsInline muted ref={myVideo} autoPlay />
          ) : (
            <div className="video-placeholder">Camera off</div>
          )}
          <div className="video-label">You</div>
        </div>
        
        {(callState === 'active' || callState === 'calling') && (
          <div className="video-player user-video">
            {callState === 'calling' ? (
              <div className="video-placeholder">Waiting for user to join...</div>
            ) : userVideo?.current?.srcObject ? (
              <video playsInline ref={userVideo} autoPlay />
            ) : (
              <div className="video-placeholder">Remote user's camera is off</div>
            )}
            <div className="video-label">{callerInfo?.username || 'User'}</div>
          </div>
        )}
      </div>

      {/* Show call controls during both active calls AND while calling */}
      {(callState === 'active' || callState === 'calling') && (
        <div className="call-controls">
          <button
            className={`toggle-audio ${!isAudioEnabled ? 'disabled' : ''}`}
            onClick={toggleAudio}
          >
            {isAudioEnabled ? 'Mute' : 'Unmute'}
          </button>
          <button
            className={`toggle-video ${!isVideoEnabled ? 'disabled' : ''}`}
            onClick={toggleVideo}
          >
            {isVideoEnabled ? 'Hide Video' : 'Show Video'}
          </button>
          <button className="end-call" onClick={endCallHandler}>
            {callState === 'calling' ? 'Cancel' : 'End Call'}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoCallInterface;