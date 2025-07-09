import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

const VideoCallScreen = ({ route, navigation }) => {
  const { friendId, friendName } = route.params;
  const { user } = useAuth();
  const { socket } = useSocket();

  const [hasPermissions, setHasPermissions] = useState(false);
  const [cameraType, setCameraType] = useState(Camera.Constants.Type.front);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callStatus, setCallStatus] = useState('connecting'); // connecting, connected, ended
  const [callDuration, setCallDuration] = useState(0);
  
  const cameraRef = useRef(null);
  const callTimerRef = useRef(null);
  
  // Request permissions on component mount
  useEffect(() => {
    const getPermissions = async () => {
      try {
        const cameraPermission = await Camera.requestCameraPermissionsAsync();
        const audioPermission = await Audio.requestPermissionsAsync();
        
        if (cameraPermission.status === 'granted' && audioPermission.status === 'granted') {
          setHasPermissions(true);
        } else {
          Alert.alert(
            'Permission Required',
            'Camera and microphone permissions are required for video calls.',
            [
              {
                text: 'OK',
                onPress: () => navigation.goBack()
              }
            ]
          );
        }
      } catch (err) {
        console.error('Error getting permissions:', err);
        Alert.alert(
          'Permission Error',
          'There was an error requesting camera and microphone permissions.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    };
    
    getPermissions();
    
    // Start call duration timer when connected
    if (callStatus === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callStatus, navigation]);
  
  useEffect(() => {
    // In a real implementation, this would connect to a WebRTC service
    // For now, we'll simulate a successful connection after a delay
    const connectTimeout = setTimeout(() => {
      setCallStatus('connected');
    }, 2000);
    
    // Setup socket event listeners for the call
    if (socket) {
      socket.on('call-accepted', () => {
        console.log('Call accepted');
        setCallStatus('connected');
      });
      
      socket.on('call-ended', () => {
        console.log('Call ended by remote user');
        endCall();
      });
    }
    
    return () => {
      clearTimeout(connectTimeout);
      
      if (socket) {
        socket.off('call-accepted');
        socket.off('call-ended');
      }
    };
  }, [socket]);
  
  // Format call duration into MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const toggleCameraType = () => {
    setCameraType(
      cameraType === Camera.Constants.Type.back
        ? Camera.Constants.Type.front
        : Camera.Constants.Type.back
    );
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  const toggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };
  
  const endCall = () => {
    // Send end call event to peer
    if (socket) {
      socket.emit('end-call', { targetUserId: friendId });
    }
    
    // Clean up and navigate back
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
    
    navigation.goBack();
  };

  if (!hasPermissions) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Requesting permissions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isVideoOn ? (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={cameraType}
          ratio="16:9"
        />
      ) : (
        <View style={styles.noVideoContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
        </View>
      )}
      
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.callStatus}>
            {callStatus === 'connecting' ? 'Connecting...' : formatDuration(callDuration)}
          </Text>
          <Text style={styles.friendName}>{friendName}</Text>
        </View>
        
        {/* Remote video would be displayed here in a real implementation */}
        {callStatus === 'connecting' && (
          <View style={styles.connectingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.connectingText}>Connecting to {friendName}...</Text>
          </View>
        )}
        
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.controlButton, styles.smallButton]}
            onPress={toggleCameraType}
          >
            <Ionicons 
              name="camera-reverse-outline" 
              size={24} 
              color="#ffffff" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.activeButton]}
            onPress={toggleMute}
          >
            <Ionicons 
              name={isMuted ? "mic-off" : "mic-outline"} 
              size={26} 
              color="#ffffff" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={endCall}
          >
            <Ionicons name="call" size={26} color="#ffffff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, !isVideoOn && styles.activeButton]}
            onPress={toggleVideo}
          >
            <Ionicons 
              name={isVideoOn ? "videocam-outline" : "videocam-off-outline"} 
              size={26} 
              color="#ffffff" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.controlButton, styles.smallButton]}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  noVideoContainer: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 50,
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 50,
  },
  header: {
    alignItems: 'center',
  },
  callStatus: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 5,
  },
  friendName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#fff',
    marginTop: 20,
    fontSize: 18,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  endCallButton: {
    backgroundColor: '#dc3545',
    transform: [{ rotate: '135deg' }],
  },
  activeButton: {
    backgroundColor: '#6366f1',
  },
});

export default VideoCallScreen;
