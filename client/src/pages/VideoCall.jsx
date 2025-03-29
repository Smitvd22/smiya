import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPeer, getUserMedia } from '../utils/webrtc';
import { getCurrentUser } from '../services/authService';
import { useCall } from '../contexts/CallContext';
import '../styles/VideoCall.css';

function VideoCall() {
  const location = useLocation();
  const navigate = useNavigate();
  const { socket } = useCall();
  const { recipientId, callerInfo: locationCallerInfo } = location.state || {};
  
  const [stream, setStream] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callerInfo, setCallerInfo] = useState(locationCallerInfo || null);
  const [callError, setCallError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('initializing');
  
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const socketRef = useRef(socket);
  const isComponentMounted = useRef(true);

  // Cleanup function to be used throughout the component
  const cleanupResources = useCallback(() => {
    if (connectionRef.current) {
      try {
        connectionRef.current.destroy();
      } catch (err) {
        console.error("Error destroying peer connection:", err);
      }
      connectionRef.current = null;
    }
    
    // Make sure to stop all media tracks properly
    if (stream) {
      try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          try {
            track.stop();
          } catch (err) {
            console.error("Error stopping track:", err);
          }
        });
      } catch (err) {
        console.error("Error stopping tracks:", err);
      }
    }
  }, [stream]);

  // Define endCallHandler with useCallback to avoid dependency issues
  const endCallHandler = useCallback(() => {
    if (!isComponentMounted.current) return;
    
    // First notify the other user about ending the call
    if (socketRef.current) {
      const callRecipient = recipientId || callerInfo?.from;
      if (callRecipient && callState !== 'idle') {
        try {
          socketRef.current.emit('end-call', { 
            to: callRecipient
          });
        } catch (err) {
          console.error("Error emitting end-call:", err);
        }
      }
    }
    
    // Clean up resources
    cleanupResources();
    
    // Set state to ensure UI updates properly
    setCallState('idle');
    
    // Navigate back after a short delay to ensure cleanup is complete
    setTimeout(() => {
      if (isComponentMounted.current) {
        navigate(-1);
      }
    }, 100);
  }, [cleanupResources, recipientId, callerInfo, callState, navigate]);

  // Track component mount status
  useEffect(() => {
    isComponentMounted.current = true;
    
    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  // Set appropriate call state when component mounts
  useEffect(() => {
    if (recipientId) {
      setCallState('calling');
    }
  }, [recipientId]);

  // Safe redirect if no valid call context
  useEffect(() => {
    if (!recipientId && callState === 'idle') {
      // No recipient ID and not receiving a call - invalid state
      const timer = setTimeout(() => {
        if (isComponentMounted.current && callState === 'idle') {
          console.log('No valid call context, redirecting back');
          navigate(-1);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [recipientId, callState, navigate]);

  // Initialize media stream
  useEffect(() => {
    let localStream = null;
    
    const initStream = async () => {
      try {
        console.log('Initializing media stream');
        const currentStream = await getUserMedia();
        
        if (!isComponentMounted.current) {
          // Component unmounted during async operation
          currentStream.getTracks().forEach(track => track.stop());
          return;
        }
        
        localStream = currentStream;
        setStream(currentStream);
        
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      } catch (err) {
        console.error("Media error:", err);
        if (isComponentMounted.current) {
          setCallError('Camera/microphone access required');
          const timer = setTimeout(() => {
            if (isComponentMounted.current) {
              if (recipientId) {
                navigate('/chat/' + recipientId, { replace: true });
              } else {
                navigate(-1);
              }
            }
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    };
    
    if (callState !== 'idle') {
      initStream();
    }
    
    return () => {
      if (localStream) {
        try {
          localStream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error("Error stopping tracks on cleanup:", err);
        }
      }
    };
  }, [callState, navigate, recipientId]);

  // Make outgoing call when recipientId is provided and stream is ready
  useEffect(() => {
    if (recipientId && stream && socketRef.current && callState === 'calling' && !connectionRef.current) {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        console.log(`Initiating call to ${recipientId}`);
        
        const peer = createPeer(
          true, 
          stream,
          signal => {
            if (socketRef.current && isComponentMounted.current) {
              socketRef.current.emit('call-user', {
                userId: recipientId,
                signalData: signal,
                from: currentUser.id,
                fromUsername: currentUser.username
              });
            }
          },
          () => console.log("Peer connection established"),
          remoteStream => {
            if (userVideo.current && isComponentMounted.current) {
              userVideo.current.srcObject = remoteStream;
            }
          },
          () => {
            console.log("Peer connection closed");
            if (isComponentMounted.current) {
              endCallHandler();
            }
          },
          error => {
            console.error("Peer error:", error);
            if (isComponentMounted.current) {
              setCallError('Connection failed');
              const timer = setTimeout(() => {
                if (isComponentMounted.current) {
                  endCallHandler();
                }
              }, 3000);
              return () => clearTimeout(timer);
            }
          }
        );
        
        connectionRef.current = peer;
      } catch (error) {
        console.error('Failed to initiate call:', error);
        if (isComponentMounted.current) {
          setCallError('Failed to initiate call');
          const timer = setTimeout(() => {
            if (isComponentMounted.current) {
              endCallHandler();
            }
          }, 3000);
          return () => clearTimeout(timer);
        }
      }
    }
  }, [recipientId, stream, callState, endCallHandler]);

  // Handle socket events for calls
  useEffect(() => {
    if (!socketRef.current) return;

    const handleIncomingCall = ({ signal, from, fromUsername }) => {
      console.log(`Incoming call from ${fromUsername} (${from})`);
      if (isComponentMounted.current) {
        setCallState('receiving');
        setCallerInfo({ signal, id: from, username: fromUsername });
      }
    };
    
    const handleCallAccepted = (signal) => {
      console.log("Call accepted, establishing connection");
      if (isComponentMounted.current) {
        setCallState('active');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      }
    };
    
    const handleCallRejected = () => {
      if (isComponentMounted.current) {
        setCallError('Call was declined');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current && callState !== 'idle') {
        setCallError('Call ended by other user');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    };

    socketRef.current.on('incoming-call', handleIncomingCall);
    socketRef.current.on('call-accepted', handleCallAccepted);
    socketRef.current.on('call-rejected', handleCallRejected);
    socketRef.current.on('call-ended', handleCallEnded);

    return () => {
      if (socketRef.current) {
        socketRef.current.off('incoming-call', handleIncomingCall);
        socketRef.current.off('call-accepted', handleCallAccepted);
        socketRef.current.off('call-rejected', handleCallRejected);
        socketRef.current.off('call-ended', handleCallEnded);
      }
    };
  }, [callState, endCallHandler]);

  useEffect(() => {
    // Check if connectionRef exists, not using it as a dependency
    if (connectionRef.current) {
      connectionRef.current.on('connect', () => setConnectionStatus('connected'));
      connectionRef.current.on('error', () => setConnectionStatus('error'));
      connectionRef.current.on('close', () => setConnectionStatus('disconnected'));
    }
    // Remove the unnecessary dependency
  }, []); // Removed connectionRef.current from dependencies

  // Use the shared socket from context instead of creating a new one
  useEffect(() => {
    socketRef.current = socket;
    
    // Only set up event listeners if socket exists and isn't already set up
    if (!socket) return;
    
    const handleCallAccepted = (signal) => {
      console.log("Call accepted, establishing connection");
      if (isComponentMounted.current) {
        setCallState('active');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      }
    };
    
    const handleCallRejected = () => {
      if (isComponentMounted.current) {
        setCallError('Call was declined');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current && callState !== 'idle') {
        setCallError('Call ended by other user');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    };
    
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    
    return () => {
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, callState, endCallHandler]);

  // Add this code at the appropriate place in the component

  // In the call handling section
  useEffect(() => {
    if (!socket) return;
    
    const handleCallAccepted = (signal) => {
      console.log("Call accepted, establishing connection");
      if (isComponentMounted.current) {
        setCallState('active');
        if (connectionRef.current) {
          connectionRef.current.signal(signal);
        }
      }
    };
    
    const handleCallRejected = () => {
      if (isComponentMounted.current) {
        setCallError('Call was declined');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current && callState !== 'idle') {
        setCallError('Call ended by other user');
        const timer = setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 1500);
        return () => clearTimeout(timer);
      }
    };
    
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-rejected', handleCallRejected);
    socket.on('call-ended', handleCallEnded);
    
    return () => {
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-rejected', handleCallRejected);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, callState, endCallHandler]);

  const answerCall = () => {
    if (!stream) {
      setCallError("No camera access");
      return;
    }
    
    try {
      setCallState('active');
      
      const peer = createPeer(
        false, 
        stream,
        signal => {
          if (socketRef.current && callerInfo && isComponentMounted.current) {
            socketRef.current.emit('answer-call', { 
              signal, 
              to: callerInfo.id 
            });
          }
        },
        () => console.log("Peer connection established"),
        remoteStream => {
          if (userVideo.current && isComponentMounted.current) {
            userVideo.current.srcObject = remoteStream;
          }
        },
        () => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        },
        error => {
          console.error("Connection error:", error);
          if (isComponentMounted.current) {
            setCallError('Connection error');
            const timer = setTimeout(() => {
              if (isComponentMounted.current) {
                endCallHandler();
              }
            }, 3000);
            return () => clearTimeout(timer);
          }
        }
      );
      
      if (callerInfo && callerInfo.signal) {
        peer.signal(callerInfo.signal);
        connectionRef.current = peer;
      } else {
        setCallError("Missing signal data");
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to answer call:', error);
      if (isComponentMounted.current) {
        setCallError('Failed to answer call');
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
      }
    }
  };

  const rejectCall = () => {
    if (socketRef.current && callerInfo) {
      try {
        socketRef.current.emit('reject-call', { to: callerInfo.id });
      } catch (err) {
        console.error("Error rejecting call:", err);
      }
    }
    endCallHandler();
  };

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
        {stream && (
          <div className="video-player my-video">
            <video playsInline muted ref={myVideo} autoPlay />
            <div className="video-label">You</div>
          </div>
        )}
        
        {callState === 'active' && (
          <div className="video-player user-video">
            <video playsInline ref={userVideo} autoPlay />
            <div className="video-label">{callerInfo?.username || 'User'}</div>
          </div>
        )}
      </div>
      
      {callState === 'active' && (
        <div className="call-controls">
          <button className="end-call" onClick={endCallHandler}>
            End Call
          </button>
        </div>
      )}

      {connectionStatus === 'connected' && <div className="connection-indicator connected">Connected</div>}
      {connectionStatus === 'error' && <div className="connection-indicator error">Connection error</div>}
    </div>
  );
}

export default VideoCall;