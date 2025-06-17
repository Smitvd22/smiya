import { createContext, useState, useEffect, useContext, useRef } from 'react';
import { initializeSocket } from '../services/authService';
import { getCurrentUser } from '../services/authService';

const CallContext = createContext();

export function CallProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

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
        } catch (err) {
          console.error('Error removing listeners:', err);
        }
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <CallContext.Provider
      value={{
        socket,
        joinChatRoom: (roomId) => {
          if (socket && socket.connected) socket.emit('join-room', roomId);
        },
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => useContext(CallContext);