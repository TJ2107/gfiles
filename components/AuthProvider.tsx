import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, LocalUser } from '../firebase';
import { UserRole } from '../types';

interface AuthContextType {
  user: LocalUser | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(null, (currentUser: LocalUser | null) => {
      setUser(currentUser);
      if (currentUser) {
        setRole((currentUser.role as UserRole) || 'User');
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

