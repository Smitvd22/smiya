import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeSocket } from '../services/authService';
import { getCurrentUser } from '../services/authService';
import IncomingCallNotification from '../components/IncomingCallNotification';

const CallContext = createContext();

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);
  const [callerInfo, setCallerInfo] = useState(null);
  const [callState, setCallState] = useState('idle');
  const socketRef = useRef(null);
  const navigate = useNavigate();

  // Initialize socket for the app
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    // Use existing socket
    const socketInstance = initializeSocket();
    if (!socketInstance) return;

    // Store socket references
    socketRef.current = socketInstance;
    setSocket(socketInstance);

    return () => {
      console.log('Cleaning up call context listeners');
      if (socketRef.current) {
        try {
          socketRef.current.off('incoming-call');
        } catch (err) {
          console.error('Error removing listeners:', err);
        }
        socketRef.current = null;
      }
    };
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    // Remove existing listeners to prevent duplicates
    socket.off('incoming-call');
    
    const handleIncomingCall = (callData) => {
      console.log('CallContext: Incoming call received', callData);
      setIncomingCall(callData);
    };

    socket.on('incoming-call', handleIncomingCall);

    return () => {
      if (socket) {
        socket.off('incoming-call', handleIncomingCall);
      }
    };
  }, [socket]);

  const handleAcceptCall = (callData) => {
    console.log('CallContext: Accepting call', callData);
    setIncomingCall(null);

    // Generate random room for the call
    const roomId = Math.random().toString(36).substring(2, 15);
    
    // Store caller info in context
    setCallerInfo({
      signal: callData.signal,
      id: callData.from,
      username: callData.fromUsername,
      fromUsername: callData.fromUsername,
      profileImage: callData.profileImage || null,
      autoAccept: true,
      signalType: callData.signalType || 'offer'
    });
    
    // Navigate to random video call instead of /videocall
    navigate(`/random-videocall/${roomId}`, {
      state: {
        callerInfo: {
          signal: callData.signal,
          id: callData.from,
          username: callData.fromUsername,
          fromUsername: callData.fromUsername,
          profileImage: callData.profileImage || null,
          autoAccept: true,
          signalType: callData.signalType || 'offer'
        },
        isHost: false
      },
      replace: true,
    });
  };

  const handleRejectCall = (callData) => {
    console.log('CallContext: Rejecting call', callData);
    if (socket && socket.connected) {
      socket.emit('reject-call', { to: callData.from });
    } else {
      console.error('Cannot reject call: socket disconnected');
    }
    setIncomingCall(null);
  };

  return (
    <CallContext.Provider
      value={{
        socket,
        callerInfo,
        setCallerInfo,
        callState,
        setCallState,
        joinChatRoom: (roomId) => {
          if (socket && socket.connected) socket.emit('join-room', roomId);
        },
      }}
    >
      {children}
      {incomingCall && (
        <IncomingCallNotification
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);