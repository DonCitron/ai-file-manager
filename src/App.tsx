import { useState, useEffect } from 'react';
import Login from './components/Login';
import FileManager from './components/FileManager';

function App() {
  const [user, setUser] = useState<{ id: number; username: string; role: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check for existing login on app start
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const authToken = localStorage.getItem('authToken');
    
    if (savedUser && authToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsLoggedIn(true);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  const handleLogin = (loggedInUser: { id: number; username: string; role: string }) => {
    setUser(loggedInUser);
    setIsLoggedIn(true);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
  };

  if (!isLoggedIn || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return <FileManager user={user} onLogout={handleLogout} />;
}

export default App;
