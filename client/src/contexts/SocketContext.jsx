import React, { useState, useEffect, useContext, createContext } from 'react';
import { getCurrentUser, initializeSocket, getSocket } from '../services/authService';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    // Get user details
    const user = getCurrentUser();
    if (!user) return;
    
    // Use the singleton socket from authService
    const socketInstance = initializeSocket();
    if (socketInstance) {
      setSocket(socketInstance);
      
      // Set up call handlers here
      socketInstance.on('incoming-call', (callData) => {
        console.log('Incoming call:', callData);
        setIncomingCall(callData);
      });
    }

    return () => {
      // Do NOT disconnect here as other components may still be using the socket
      // Just clean up event listeners
      if (socketInstance) {
        socketInstance.off('incoming-call');
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);