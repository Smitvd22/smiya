import React, { createContext, useState, useContext, useRef } from 'react';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSocket } from './SocketContext';
import { getSocket } from '../services/authService';

const CallContext = createContext();

export const CallProvider = ({ children }) => {
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, connected, ended
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callData, setCallData] = useState(null);
  const peerConnections = useRef({});
  const navigation = useNavigation();
  const { socket } = useSocket();

  // Initialize a call
  const initiateCall = async (friendId, friendName) => {
    try {
      setCallStatus('connecting');
      
      // Store call information
      const newCallData = {
        friendId,
        friendName,
        type: 'outgoing',
        startTime: Date.now(),
      };
      setCallData(newCallData);
      
      // Navigate to call screen
      navigation.navigate('VideoCall', { friendId, friendName });
      
      // Emit call signal to server
      if (socket) {
        socket.emit('call-user', { targetUserId: friendId });
        console.log('Call initiated to friend:', friendId);
      } else {
        throw new Error('Socket connection not available');
      }

      return true;
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallStatus('idle');
      return false;
    }
  };

  // Handle accepting an incoming call
  const acceptCall = (incomingCallData) => {
    try {
      setCallStatus('connecting');
      
      const acceptedCallData = {
        ...incomingCallData,
        type: 'incoming',
        startTime: Date.now(),
      };
      setCallData(acceptedCallData);
      
      // Navigate to call screen
      navigation.navigate('VideoCall', {
        friendId: incomingCallData.callerId,
        friendName: incomingCallData.callerName,
      });
      
      // Emit call accepted to server
      if (socket) {
        socket.emit('call-accepted', { callerId: incomingCallData.callerId });
        console.log('Call accepted from:', incomingCallData.callerName);
      }
      
      return true;
    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('idle');
      return false;
    }
  };

  // Handle rejecting or ending a call
  const endCall = (reason = 'ended') => {
    try {
      // Clean up streams
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }
      
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
      }
      
      // Close peer connections
      Object.values(peerConnections.current).forEach(pc => {
        if (pc) pc.close();
      });
      peerConnections.current = {};
      
      // Update status
      setCallStatus('idle');
      
      // Emit end call to server if socket exists and we have callData
      const currentSocket = getSocket();
      if (currentSocket && callData) {
        const targetId = callData.type === 'outgoing' ? callData.friendId : callData.callerId;
        currentSocket.emit('call-ended', { targetUserId: targetId, reason });
      }
      
      // Reset call data
      setCallData(null);
      
      return true;
    } catch (error) {
      console.error('Error ending call:', error);
      return false;
    }
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        setCallStatus,
        remoteStream,
        setRemoteStream,
        localStream,
        setLocalStream,
        callData,
        setCallData,
        peerConnections: peerConnections.current,
        initiateCall,
        acceptCall,
        endCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
