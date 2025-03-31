import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getCurrentUser } from '../services/authService';
import IncomingCallNotification from '../components/IncomingCallNotification';

const CallContext = createContext();
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();
  
  // Single socket initialization for the entire app
  useEffect(() => {
    const user = getCurrentUser();
    if (!user || socket) return; // Prevent duplicate connections
    
    console.log('Initializing global socket connection');
    
    const socketInstance = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      autoConnect: true
    });
    
    // Store socket reference immediately to avoid race conditions
    socketRef.current = socketInstance;
    
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
    
    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    setSocket(socketInstance);
    
    return () => {
      console.log('Cleaning up socket connection');
      if (socketInstance) {
        // Always try to clean up listeners first
        try {
          socketInstance.off('incoming-call');
          socketInstance.off('connect');
          socketInstance.off('disconnect');
          socketInstance.off('connect_error');
          socketInstance.off('error');
        } catch (err) {
          console.error('Error removing socket listeners:', err);
        }
        
        // Then try to disconnect if connected
        if (socketInstance.connected) {
          try {
            socketInstance.disconnect();
          } catch (err) {
            console.error('Error disconnecting socket:', err);
          }
        }
        
        socketRef.current = null;
      }
    };
  }, []); // Empty dependency array to create socket only once
  
  // Listen for incoming calls - using socketRef to avoid dependency issues
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket) return;
    
    const handleIncomingCall = (callData) => {
      console.log('CallContext: Incoming call received', callData);
      setIncomingCall(callData);
    };
    
    currentSocket.on('incoming-call', handleIncomingCall);
    
    return () => {
      if (currentSocket) {
        try {
          currentSocket.off('incoming-call', handleIncomingCall);
        } catch (err) {
          console.error('Error removing incoming-call listener:', err);
        }
      }
    };
  }, [socketRef.current]); // This will run once and when the socket reference changes
  
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
    const currentSocket = socketRef.current;
    if (currentSocket) {
      currentSocket.emit('reject-call', { to: callData.from });
    }
    setIncomingCall(null);
  };
  
  return (
    <CallContext.Provider 
      value={{ 
        socket, 
        joinChatRoom: (roomId) => {
          const currentSocket = socketRef.current;
          if (currentSocket) currentSocket.emit('join-room', roomId);
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