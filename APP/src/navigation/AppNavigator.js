import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity, View, Text, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import FriendsScreen from '../screens/FriendsScreen';
import ChatScreen from '../screens/ChatScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VideoCallScreen from '../screens/VideoCallScreen';
import BirthdayWishScreen from '../screens/BirthdayWishScreen';
import LandingScreen from '../screens/LandingScreen';
import IncomingCallScreen from '../screens/IncomingCallScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for authenticated users
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Friends') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1', // Indigo color from the web app
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Chat" component={ChatStackScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Stack for Chat-related screens
const ChatStack = createStackNavigator();

// ChatStack wrapper for nested navigation within the Chat tab
const ChatStackScreen = () => {
  return (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
      <ChatStack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'Chats' }} />
      <ChatStack.Screen 
        name="ChatDetail" 
        component={ChatScreen} 
        options={({ route }) => ({ title: route.params?.friendName || 'Chat' })} 
      />
    </ChatStack.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { user, loading } = useAuth();
  const { incomingCall, setIncomingCall } = useSocket();
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>
        <Text style={{ fontSize: 18, color: '#6366f1' }}>Loading...</Text>
      </View>
    );
  }
  
  // Handle incoming call modal
  useEffect(() => {
    if (incomingCall) {
      setShowIncomingCall(true);
    } else {
      setShowIncomingCall(false);
    }
  }, [incomingCall]);
  
  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          // Unauthenticated routes
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="BirthdayWish" component={BirthdayWishScreen} />
          </>
        ) : (
          // Authenticated routes
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ChatDetail" component={ChatScreen} />
            <Stack.Screen 
              name="VideoCall" 
              component={VideoCallScreen}
              options={{ gestureEnabled: false }} // Prevent swiping back during a call
            />
            <Stack.Screen name="BirthdayWish" component={BirthdayWishScreen} />
            <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
          </>
        )}
      </Stack.Navigator>
      
      {/* Show incoming call UI when there's an incoming call */}
      {incomingCall && (
        <IncomingCallScreen
          callData={incomingCall}
          onAccept={() => {
            // Handle accepting call
            setIncomingCall(null);
          }}
          onReject={() => {
            // Handle rejecting call
            setIncomingCall(null);
          }}
        />
      )}
    </>
  );
};

export default AppNavigator;
