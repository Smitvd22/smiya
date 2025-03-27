import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
import Navbar from './components/Navbar';
import './App.css';

function App() {
  return (  
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/chat/:friendId" element={<Chat />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
