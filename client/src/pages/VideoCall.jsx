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
  const [socketConnected, setSocketConnected] = useState(false);
  
  const myVideo = useRef(null);
  const userVideo = useRef(null);
  const connectionRef = useRef(null);
  const socketRef = useRef(socket);
  const isComponentMounted = useRef(true);

  // Define the setupConnectionListeners function with useCallback
  const setupConnectionListeners = useCallback((peer) => {
    if (!peer) return;
    
    peer.on('connect', () => {
      if (isComponentMounted.current) {
        setConnectionStatus('connected');
        console.log("Peer connection established!");
      }
    });
    
    peer.on('error', (err) => {
      console.error("Peer connection error:", err);
      if (isComponentMounted.current) {
        setConnectionStatus('error');
      }
    });
    
    peer.on('close', () => {
      console.log("Peer connection closed");
      if (isComponentMounted.current) {
        setConnectionStatus('disconnected');
      }
    });

    peer.on('data', (data) => {
      console.log("Received data from peer:", data);
    });
  }, []);

  // Add this useEffect near the beginning of the component
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // Add this effect to monitor socket status
  useEffect(() => {
    if (!socket) {
      console.error("Socket is not available from context");
      setSocketConnected(false);
      return;
    }
  
    setSocketConnected(socket.connected);
  
    const handleConnect = () => {
      console.log("Socket connected in VideoCall component");
      setSocketConnected(true);
      
      // Join user room on reconnection
      const currentUser = getCurrentUser();
      if (currentUser) {
        socket.emit('join-user-room', `user-${currentUser.id}`);
        console.log(`Joined user room: user-${currentUser.id}`);
      }
    };
  
    const handleDisconnect = () => {
      console.log("Socket disconnected in VideoCall component");
      setSocketConnected(false);
    };
  
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
  
    // Ensure we're properly connected when the component loads
    if (socket.connected) {
      handleConnect();
    }
  
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [socket]);

  // Cleanup function to be used throughout the component
  const cleanupResources = useCallback(() => {
    // Handle peer connection cleanup
    if (connectionRef.current) {
      try {
        // Remove all listeners before destroying the peer
        connectionRef.current.removeAllListeners();
        connectionRef.current.destroy();
      } catch (err) {
        console.error("Error destroying peer connection:", err);
      } finally {
        connectionRef.current = null;
      }
    }
    
    // Make sure to stop all media tracks properly
    if (stream) {
      try {
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          try {
            if (track.readyState === 'live') {
              track.stop();
            }
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
    
    // Prevent multiple cleanup triggers 
    if (callState === 'idle') return;
    
    // First notify the other user about ending the call
    if (socketRef.current) {
      // Fix to correctly get the caller/recipient ID
      const callRecipient = recipientId || (callerInfo && callerInfo.id);
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
    
    // Rest of the function remains the same
    try {
      cleanupResources();
    } catch (err) {
      console.error("Error during resource cleanup:", err);
    }
    
    setCallState('idle');
    
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
    if (!recipientId && !callerInfo && callState === 'idle') {
      console.log('No valid call context, redirecting back');
      const timer = setTimeout(() => {
        if (isComponentMounted.current) {
          navigate(-1);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [recipientId, callerInfo, callState, navigate]);

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

  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  // Make outgoing call when recipientId is provided and stream is ready
  useEffect(() => {
    if (recipientId && stream && socketRef.current && callState === 'calling' && !connectionRef.current) {
      try {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        console.log(`Initiating call to ${recipientId} with stream:`, stream);
        console.log('Socket connected:', socketRef.current?.connected);
        
        const peer = createPeer(
          true, // Is the initiator 
          stream,
          signal => {
            if (socketRef.current && socketRef.current.connected && isComponentMounted.current) {
              console.log(`Emitting call-user to ${recipientId} with signal:`, signal);
              socketRef.current.emit('call-user', {
                userId: recipientId,
                signalData: signal,
                from: currentUser.id,
                fromUsername: currentUser.username
              });
            } else {
              console.error("Cannot emit call-user: Socket not connected", socketRef.current);
              setCallError("Connection to server lost");
            }
          },
          () => {
            console.log("Peer connection established for caller");
            setConnectionStatus('connected');
          },
          remoteStream => {
            console.log("Received remote stream:", remoteStream);
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
              setTimeout(() => {
                if (isComponentMounted.current) {
                  endCallHandler();
                }
              }, 3000);
            }
          }
        );
        
        connectionRef.current = peer;
        setupConnectionListeners(peer);
      } catch (error) {
        console.error('Failed to initiate call:', error);
        if (isComponentMounted.current) {
          setCallError('Failed to initiate call');
          setTimeout(() => {
            if (isComponentMounted.current) {
              endCallHandler();
            }
          }, 3000);
        }
      }
    }
  }, [recipientId, stream, callState, endCallHandler, setupConnectionListeners]);

  // Handle socket events for calls
  useEffect(() => {
    if (!socketRef.current) {
      console.error("No socket available for event registration");
      return;
    }

    console.log("Registering call event handlers on socket:", socketRef.current.id);

    const handleIncomingCall = ({ signal, from, fromUsername }) => {
      console.log(`Incoming call from ${fromUsername} (${from})`, signal);
      if (isComponentMounted.current) {
        setCallState('receiving');
        setCallerInfo({ signal, id: from, username: fromUsername });
      }
    };
    
    const handleCallAccepted = (data) => {
      console.log("Call accepted, establishing connection with signal:", data);
      if (isComponentMounted.current) {
        setCallState('active');
        if (connectionRef.current) {
          console.log("Sending signal to peer:", data.signal);
          connectionRef.current.signal(data.signal);
        } else {
          console.error("Cannot handle accepted call: connectionRef is null");
          setCallError("Connection error");
        }
      }
    };
    
    const handleCallRejected = () => {
      if (isComponentMounted.current) {
        setCallError('Call was declined');
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 3000);
      }
    };
    
    const handleCallEnded = () => {
      if (isComponentMounted.current && callState !== 'idle') {
        setCallError('Call ended by other user');
        setTimeout(() => {
          if (isComponentMounted.current) {
            endCallHandler();
          }
        }, 1500);
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

  // Modify your socket event useEffect to verify socket connection
  useEffect(() => {
    if (!socketRef.current) {
      console.error("No socket available for event registration");
      return;
    }

    console.log("Registering call event handlers on socket:", socketRef.current.id);

    // Rest of your event handler code...
  }, [callState, endCallHandler]);

  const answerCall = () => {
    if (!stream) {
      setCallError("No camera access");
      return;
    }
    
    if (!callerInfo || !callerInfo.signal) {
      setCallError("Missing caller information");
      setTimeout(() => {
        if (isComponentMounted.current) {
          endCallHandler();
        }
      }, 2000);
      return;
    }
    
    try {
      // Set call as active immediately to update UI
      setCallState('active');
      
      const peer = createPeer(
        false, // Not the initiator
        stream,
        signal => {
          if (socketRef.current && callerInfo && isComponentMounted.current) {
            console.log("Answering call with signal:", signal);
            socketRef.current.emit('answer-call', { 
              signal, 
              to: callerInfo.id 
            });
          }
        },
        () => {
          console.log("Peer connection established for answerer");
          setConnectionStatus('connected');
        },
        remoteStream => {
          console.log("Received remote stream:", remoteStream);
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
            setTimeout(() => {
              if (isComponentMounted.current) {
                endCallHandler();
              }
            }, 3000);
          }
        }
      );
      
      // Log the signal we're processing
      console.log("Processing incoming signal:", callerInfo.signal);
      peer.signal(callerInfo.signal);
      connectionRef.current = peer;
      setupConnectionListeners(peer);
    } catch (error) {
      console.error('Failed to answer call:', error);
      setCallError('Failed to answer call');
      setTimeout(() => {
        if (isComponentMounted.current) {
          endCallHandler();
        }
      }, 3000);
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
        
        {(callState === 'active' || callState === 'connected') && (
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
      {!socketConnected && callState !== 'idle' && (
        <div className="connection-indicator error">
          Socket disconnected - call functionality limited
        </div>
      )}

      {/* Debug info */}
      <div className="debug-info" style={{fontSize: '10px', color: '#666', margin: '10px', textAlign: 'left'}}>
        <div>Call State: {callState}</div>
        <div>Connection: {connectionStatus}</div>
        <div>Socket: {socketConnected ? 'Connected' : 'Disconnected'}</div>
        {callerInfo && <div>Caller: {callerInfo.username} (ID: {callerInfo.id})</div>}
        {recipientId && <div>Recipient ID: {recipientId}</div>}
      </div>
    </div>
  );
}

export default VideoCall;