import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ImageBackground, StatusBar } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const LandingScreen = ({ navigation }) => {
  const { user } = useAuth();

  const goToLogin = () => {
    navigation.navigate('Login');
  };

  const goToRegister = () => {
    navigation.navigate('Register');
  };

  // If user is already logged in, redirect to Home screen
  React.useEffect(() => {
    if (user) {
      navigation.navigate('Main');
    }
  }, [user, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>Smiya</Text>
          <Text style={styles.tagline}>Connect with the ones who matter</Text>
        </View>
        
        <View style={styles.featureContainer}>
          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Real-time Messaging</Text>
            <Text style={styles.featureDescription}>Connect with friends and family instantly</Text>
          </View>
          
          <View style={styles.feature}>
            <Text style={styles.featureTitle}>Video Calls</Text>
            <Text style={styles.featureDescription}>Face-to-face conversations no matter the distance</Text>
          </View>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={goToLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={goToRegister}>
            <Text style={styles.secondaryButtonText}>Register</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6366f1',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
  },
  featureContainer: {
    width: '100%',
    marginBottom: 60,
  },
  feature: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.8,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LandingScreen;
