import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, LocalUser } from '../firebase';

interface AuthContextType {
  user: LocalUser | null;
  role: 'User' | 'Manager' | 'Admin' | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [role, setRole] = useState<'User' | 'Manager' | 'Admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(null, (currentUser: LocalUser | null) => {
      setUser(currentUser);
      if (currentUser) {
        setRole(currentUser.role || 'User');
      } else {
        setRole(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

