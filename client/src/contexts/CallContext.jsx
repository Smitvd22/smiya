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
    if (!user) return;
    
    // Only create a socket if we don't already have one
    if (socketRef.current) return;
    
    console.log('Initializing global socket connection');
    
    const socketInstance = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket'],
      autoConnect: true
    });
    
    // Store socket reference immediately to avoid race conditions
    socketRef.current = socketInstance;
    
    socketInstance.on('connect', () => {
      console.log('Socket connected with ID:', socketInstance.id);
      // Join the user-specific room for receiving calls
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
      console.log('Cleaning up socket connection on unmount');
      if (socketRef.current) {
        // Always try to clean up listeners first
        try {
          socketRef.current.off('connect');
          socketRef.current.off('disconnect');
          socketRef.current.off('connect_error');
          socketRef.current.off('error');
          socketRef.current.off('incoming-call');
        } catch (err) {
          console.error('Error removing socket listeners:', err);
        }
        
        // Then try to disconnect if connected
        if (socketRef.current.connected) {
          try {
            socketRef.current.disconnect();
          } catch (err) {
            console.error('Error disconnecting socket:', err);
          }
        }
        
        socketRef.current = null;
        setSocket(null);
      }
    };
  }, []); // Empty dependency array to initialize socket only once
  
  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;
    
    // Debug to confirm this effect runs when socket is available
    console.log('Setting up incoming call listener on socket:', socket.id);
    
    const handleIncomingCall = (callData) => {
      console.log('CallContext: Incoming call received', callData);
      setIncomingCall(callData);
    };
    
    // First remove any existing listener to prevent duplicates
    socket.off('incoming-call');
    
    // Then add the new listener
    socket.on('incoming-call', handleIncomingCall);
    
    return () => {
      console.log('Cleaning up incoming call listener');
      if (socket) {
        try {
          socket.off('incoming-call', handleIncomingCall);
        } catch (err) {
          console.error('Error removing incoming-call listener:', err);
        }
      }
    };
  }, [socket]); // This dependency is correct
  
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
      replace: true
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
  
  // Debug when incomingCall state changes
  useEffect(() => {
    if (incomingCall) {
      console.log('Incoming call state updated:', incomingCall);
    }
  }, [incomingCall]);
  
  return (
    <CallContext.Provider 
      value={{ 
        socket, 
        joinChatRoom: (roomId) => {
          if (socket && socket.connected) socket.emit('join-room', roomId);
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