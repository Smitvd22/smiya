import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/VideoRoom.css';

const CreateVideoRoom = () => {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  
  const createRoom = async () => {
    try {
      setIsCreating(true);
      setError('');
      
      const response = await axios.get(`${API_URL}/videoroom/create`);
      const { roomId } = response.data;
      
      if (roomId) {
        navigate(`/videoroom/${roomId}`);
      } else {
        setError('Could not create room');
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };
  
  const joinRoom = () => {
    const roomId = prompt('Enter room ID:');
    if (roomId && roomId.trim()) {
      navigate(`/videoroom/${roomId.trim()}`);
    }
  };
  
  return (
    <div className="create-room-container">
      <h1>Video Chat Rooms</h1>
      
      <div className="room-buttons">
        <button 
          onClick={createRoom} 
          disabled={isCreating} 
          className="room-button create"
        >
          {isCreating ? 'Creating...' : 'Create New Room'}
        </button>
        
        <button onClick={joinRoom} className="room-button join">
          Join Existing Room
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default CreateVideoRoom;