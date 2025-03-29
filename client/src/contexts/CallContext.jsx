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
    const socketInstance = io(SOCKET_URL, {
      reconnectionAttempts: 3,
      timeout: 10000
    });
    
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      socketInstance.emit('join-user-room', `user-${user.id}`);
    });
    
    setSocket(socketInstance);
    
    return () => {
      console.log('Cleaning up socket connection');
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, []);
  
  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;
    
    socket.on('incoming-call', (callData) => {
      console.log('CallContext: Incoming call received', callData);
      setIncomingCall(callData);
    });
    
    return () => {
      socket.off('incoming-call');
    };
  }, [socket]);
  
  const handleAcceptCall = (callData) => {
    console.log('CallContext: Accepting call', callData);
    setIncomingCall(null);
    navigate('/videocall', { state: { callerInfo: callData } });
  };
  
  const handleRejectCall = (callData) => {
    console.log('CallContext: Rejecting call', callData);
    if (socket) {
      socket.emit('reject-call', { to: callData.from });
    }
    setIncomingCall(null);
  };
  
  return (
    <CallContext.Provider value={{ socket, joinChatRoom: (roomId) => {
      if (socket) socket.emit('join-room', roomId);
    }}}>
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