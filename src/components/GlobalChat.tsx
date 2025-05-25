import React, { useEffect, useState, useRef } from 'react';

interface ChatMessage {
  id: number;
  userId: number;
  username: string;
  message: string;
  timestamp: string;
}

export const GlobalChat: React.FC<{ currentUser: { id: number; username: string } }> = ({ currentUser }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    const res = await fetch('/chat/global', { credentials: 'include' });
    const data = await res.json();
    setMessages(data.messages);
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    await fetch('/chat/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message: input })
    });
    setInput('');
    fetchMessages();
  };

  return (
    <div className="flex flex-col h-full border rounded bg-gray-900">
      <div className="flex-1 overflow-y-auto p-2">
        {messages.map(msg => (
          <div key={msg.id} className={msg.userId === currentUser.id ? 'text-blue-400' : 'text-white'}>
            <span className="font-bold">{msg.username}:</span> {msg.message}
            <span className="text-xs text-gray-500 ml-2">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-2 flex gap-2">
        <input
          className="flex-1 rounded bg-gray-800 text-white p-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Nachricht eingeben..."
        />
        <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={sendMessage}>Senden</button>
      </div>
    </div>
  );
};