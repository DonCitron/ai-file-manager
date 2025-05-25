import { useState, useEffect } from 'react';
import Login from './components/Login';
import FileManager from './components/FileManager';

// Simple Error Boundary
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  // @ts-ignore
  window.__setAppError = setError;
  if (error) {
    return <div style={{ color: 'red', padding: 32 }}>Fehler: {error.message}</div>;
  }
  return children;
}

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

export default function AppWithBoundary() {
  return <ErrorBoundary><App /></ErrorBoundary>;  
}
