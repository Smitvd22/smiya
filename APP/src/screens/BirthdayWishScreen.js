import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const BirthdayWishScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  
  // In a real app, these would be loaded from a server or local assets
  // Using hardcoded placeholder colors for now until actual images are added
  const photos = [
    { id: '1', color: '#ff6b6b' },
    { id: '2', color: '#4ecdc4' },
    { id: '3', color: '#ffe66d' },
    { id: '4', color: '#ff8364' },
    { id: '5', color: '#6a0572' },
  ];
  
  useEffect(() => {
    // Simulate loading assets
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Preparing something special...</Text>
        </View>
      ) : (
        <>
          {/* Background gradient instead of video */}
          <LinearGradient
            colors={['#6a0572', '#ab83a1', '#6a0572']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.backgroundGradient}
          />
          
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <Text style={styles.title}>Happy Birthday!</Text>
            
            <Text style={styles.message}>
              Today is all about you! May this year bring you endless joy, 
              success in all your endeavors, and countless reasons to smile.
              Thank you for being an amazing person in my life.
            </Text>
            
            <Text style={styles.sectionTitle}>Our Memories</Text>
            
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <TouchableOpacity 
                  key={photo.id}
                  style={styles.photoContainer}
                >
                  <View style={[styles.photo, { backgroundColor: photo.color }]}>
                    <Text style={styles.photoPlaceholderText}>Photo {photo.id}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.wishText}>
              Wishing you a fantastic birthday filled with love, laughter, and everything that makes you happy!
            </Text>
          </ScrollView>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Landing')}
          >
            <Ionicons name="arrow-back-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </>
      )}
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
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#4a148c',
    opacity: 0.9,
  },
  contentContainer: {
    flexGrow: 1,
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  message: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 30,
  },
  photoContainer: {
    width: width / 2 - 30,
    height: width / 2 - 30,
    margin: 5,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photo: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    fontWeight: 'bold',
  },
  wishText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 100,
  },
});

export default BirthdayWishScreen;
