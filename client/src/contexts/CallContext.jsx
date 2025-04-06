import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initializeSocket} from '../services/authService';
import { getCurrentUser } from '../services/authService';
import IncomingCallNotification from '../components/IncomingCallNotification';

const CallContext = createContext();

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const navigate = useNavigate();

  // Single socket initialization for the entire app
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    // Use the existing singleton socket
    const socketInstance = initializeSocket();
    if (!socketInstance) return;

    // Store reference and set state
    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Listen for socket events here
    // No need to handle connect/disconnect as authService already does this

    return () => {
      console.log('Cleaning up call context listeners');
      if (socketRef.current) {
        try {
          socketRef.current.off('incoming-call');
        } catch (err) {
          console.error('Error removing listeners:', err);
        }

        // Don't disconnect here - authService manages the socket lifecycle
        socketRef.current = null;
        setSocket(null);
      }
    };
  }, []);

  // Listen for incoming calls
  useEffect(() => {
    if (!socket) return;

    // First remove any existing listener to prevent duplicates
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

    // Navigate to video call page with caller info
    navigate('/videocall', {
      state: {
        callerInfo: {
          signal: callData.signal,
          id: callData.from,
          username: callData.fromUsername,
        },
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