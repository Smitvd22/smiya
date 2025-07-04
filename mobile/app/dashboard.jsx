import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function Dashboard() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back!</Text>
      </View>
      
      <View style={styles.cardContainer}>
        <Link href="/friends" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Friends</Text>
            <Text style={styles.cardDescription}>Connect with your friends</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/chat" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Chat</Text>
            <Text style={styles.cardDescription}>Message your connections</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/birthday-wishes" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Birthday Wishes</Text>
            <Text style={styles.cardDescription}>Send birthday wishes</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/video-call" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Video Call</Text>
            <Text style={styles.cardDescription}>Connect via video</Text>
          </TouchableOpacity>
        </Link>
        
        <Link href="/previous-year" asChild>
          <TouchableOpacity style={styles.card}>
            <Text style={styles.cardTitle}>Previous Year</Text>
            <Text style={styles.cardDescription}>View past memories</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#f87171',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    opacity: 0.8,
  },
  cardContainer: {
    padding: 15,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#f87171',
  },
  cardDescription: {
    fontSize: 16,
    color: '#666',
  },
});