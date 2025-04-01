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
}) => {
  return (
    <div className="video-call-container active">
      {callError && <div className="call-error">{callError}</div>}

      {callState === 'receiving' && (
        <div className="incoming-call-notification">
          <h3>Incoming call from {callerInfo?.username || 'Unknown'}</h3>
          <div className="call-actions">
            <button className="answer-call" onClick={answerCall}>Accept</button>
            <button className="reject-call" onClick={rejectCall}>Reject</button>
          </div>
        </div>
      )}

      {callState === 'calling' && (
        <div className="call-status">
          <h3>Calling...</h3>
          <p>Waiting for answer</p>
          <button className="end-call" onClick={endCallHandler}>Cancel</button>
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
        
        {callState === 'active' && (
          <div className="video-player user-video">
            <video playsInline ref={userVideo} autoPlay />
            <div className="video-label">{callerInfo?.username || 'User'}</div>
          </div>
        )}
      </div>

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
          End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCallInterface;