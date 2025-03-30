import React, { createContext, useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getCurrentUser } from '../services/authService';
import IncomingCallNotification from '../components/IncomingCallNotification';

const CallContext = createContext();
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();
  
  // Single socket initialization for the entire app
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    
    console.log('Initializing global socket connection');
    
    // Fix socket initialization with proper options
    const socketInstance = io(SOCKET_URL, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      autoConnect: true
    });
    
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      socketInstance.emit('join-user-room', `user-${user.id}`);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
    
    setSocket(socketInstance);
    
    return () => {
      console.log('Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []); // No dependencies needed here
  
  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;
    
    const handleIncomingCall = (callData) => {
      console.log('CallContext: Incoming call received', callData);
      setIncomingCall(callData);
    };
    
    socket.on('incoming-call', handleIncomingCall);
    
    return () => {
      socket.off('incoming-call', handleIncomingCall);
    };
  }, [socket]);
  
  const handleAcceptCall = (callData) => {
    console.log('CallContext: Accepting call', callData);
    setIncomingCall(null);
    
    // Navigate to video call page with caller info
    navigate('/videocall', { 
      state: { 
        callerInfo: {
          signal: callData.signal,
          id: callData.from,
          username: callData.fromUsername
        }
      },
      replace: true // Add replace: true to prevent navigation issues
    });
  };
  
  const handleRejectCall = (callData) => {
    console.log('CallContext: Rejecting call', callData);
    if (socket) {
      socket.emit('reject-call', { to: callData.from });
    }
    setIncomingCall(null);
  };
  
  return (
    <CallContext.Provider 
      value={{ 
        socket, 
        joinChatRoom: (roomId) => {
          if (socket) socket.emit('join-room', roomId);
        }
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