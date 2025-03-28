import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { getCurrentUser } from './services/authService';
import './App.css';

function App() {
  // Function to check if user is authenticated
  const isAuthenticated = () => {
    const user = getCurrentUser();
    return !!user && !!user.token;
  };
  
  return (  
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route 
            path="/login" 
            element={isAuthenticated() ? <Navigate to="/friends" /> : <Login />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated() ? <Navigate to="/friends" /> : <Register />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/friends" 
            element={
              <ProtectedRoute>
                <Friends />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat/:friendId" 
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } 
          />
          
          {/* Redirect all other routes */}
          <Route path="*" element={isAuthenticated() ? <Navigate to="/friends" /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
