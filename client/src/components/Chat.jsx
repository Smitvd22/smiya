import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const socket = io(process.env.REACT_APP_SOCKET_URL);

  useEffect(() => {
    socket.on('message', (data) => {
      setMessages((prev) => [...prev, data]);
    });
  }, []);

  return (
    <div className="p-4">
      {messages.map((msg) => (
        <div key={msg.id} className="bg-gray-100 p-2 my-2">
          {msg.text}
        </div>
      ))}
    </div>
  );
}