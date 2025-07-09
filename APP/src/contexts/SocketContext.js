import React, { createContext, useState, useContext, useEffect } from 'react';
import { initializeSocket, getSocket } from '../services/authService';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    // Initialize socket when user is authenticated
    if (user) {
      const socketInstance = initializeSocket();
      if (socketInstance) {
        setSocket(socketInstance);
        
        // Set up call handlers
        socketInstance.on('incoming-call', (callData) => {
          console.log('Incoming call:', callData);
          setIncomingCall(callData);
        });
      }
    } else {
      setSocket(null);
    }

    // Clean up event listeners but don't disconnect
    return () => {
      const currentSocket = getSocket();
      if (currentSocket) {
        currentSocket.off('incoming-call');
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, incomingCall, setIncomingCall }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
