import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../contexts/SocketContext';
import { useCall } from '../contexts/CallContext';

const IncomingCallScreen = ({ navigation }) => {
  const { incomingCall, setIncomingCall } = useSocket();
  const { acceptCall } = useCall();
  const [callTimer, setCallTimer] = useState(30); // 30 second timeout for incoming call
  
  useEffect(() => {
    // Start a countdown for the call
    const timer = setInterval(() => {
      setCallTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRejectCall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  const handleAcceptCall = () => {
    if (incomingCall) {
      // Use the call context to accept the call
      const success = acceptCall(incomingCall);
      
      if (success) {
        // Reset incoming call data
        setIncomingCall(null);
        
        // Navigation is handled by acceptCall in the CallContext
      }
    }
  };
  
  const handleRejectCall = () => {
    if (incomingCall && incomingCall.callerId) {
      // Emit call rejection event via socket
      const { socket } = useSocket();
      if (socket) {
        socket.emit('call-rejected', { callerId: incomingCall.callerId });
      }
    }
    
    // Reset incoming call data and go back
    setIncomingCall(null);
    navigation.goBack();
  };

  if (!incomingCall) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.callerInfo}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {incomingCall.callerName ? incomingCall.callerName.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <Text style={styles.callerName}>{incomingCall.callerName}</Text>
        <Text style={styles.callType}>Incoming Video Call</Text>
        <Text style={styles.callTimer}>{callTimer}s</Text>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]}
          onPress={handleRejectCall}
        >
          <Ionicons name="call" size={30} color="#fff" style={styles.rejectIcon} />
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.acceptButton]}
          onPress={handleAcceptCall}
        >
          <Ionicons name="call" size={30} color="#fff" />
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  callerInfo: {
    alignItems: 'center',
    marginTop: 80,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 50,
    fontWeight: 'bold',
  },
  callerName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  callType: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 20,
  },
  callTimer: {
    fontSize: 16,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
    marginBottom: 40,
  },
  actionButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4caf50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  rejectIcon: {
    transform: [{ rotate: '135deg' }],
  },
  buttonText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
});

export default IncomingCallScreen;
