import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';

import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Bypassing real Firebase Auth because it is not enabled in the managed project.
export const auth = {}; 
export const googleProvider = null;

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: string;
}

export type LocalUser = AuthUser;

const authListeners: Array<(user: AuthUser | null) => void> = [];

let hasDetectedQuotaError = false;

// Function to reset quota status and try Firebase again
export const resetQuotaStatus = () => {
  hasDetectedQuotaError = false;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('force_d1_active');
  }
};

const isForceD1Active = (): boolean => {
  return typeof window !== 'undefined' && localStorage.getItem('force_d1_active') === 'true';
};

const triggerQuotaExceeded = () => {
  hasDetectedQuotaError = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
  }
};

export const loginWithGoogle = async () => {
  throw new Error("La connexion Google n'est pas configurée. Veuillez utiliser l'email.");
};

export const loginWithEmail = async (email: string, _pass: string) => {
  const uid = email.replace(/[^a-zA-Z0-9]/g, '_');
  
  // 1. If quota error already detected or forced D1, use backup API first
  if (isForceD1Active() || hasDetectedQuotaError) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: _pass || 'default' })
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.user) {
          const userObj = {
            uid: body.user.uid,
            email: body.user.email,
            displayName: body.user.displayName,
            role: body.user.role
          };
          localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
          authListeners.forEach(cb => cb(userObj));
          return userObj;
        }
      }
    } catch (apiErr) {
      console.error('Backup API auth failed:', apiErr);
    }
    
    // Fallback to local memory/offline auth
    const role = (email === 'cyber.kan587@gmail.com') ? 'Admin' : 'User';
    const userObj = { uid, email, displayName: email.split('@')[0], role };
    localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
    authListeners.forEach(cb => cb(userObj));
    return userObj;
  }

  // 2. Otherwise try standard Firebase
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    let userData = userDoc.data();
    
    let role = (email === 'cyber.kan587@gmail.com') ? 'Admin' : 'User';
    
    if (!userData) {
      await setDoc(doc(db, 'users', uid), {
        email,
        name: email.split('@')[0],
        role,
        createdAt: Date.now()
      });
      userData = { email, name: email.split('@')[0], role };
    } else {
      role = (email === 'cyber.kan587@gmail.com') ? 'Admin' : (userData.role || 'User');
    }
    
    const userObj = { uid, email, displayName: userData.name || email, role };
    localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
    
    authListeners.forEach(cb => cb(userObj));
    return userObj;
  } catch (error) {
    console.warn('Firebase login failed, trying server API or local auth fallback...', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    }
    
    // Fallback 1: Server login API
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: _pass || 'default' })
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.user) {
          const userObj = {
            uid: body.user.uid,
            email: body.user.email,
            displayName: body.user.displayName,
            role: body.user.role
          };
          localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
          authListeners.forEach(cb => cb(userObj));
          return userObj;
        }
      }
    } catch (apiErr) {
      console.error('Backup API auth failed:', apiErr);
    }

    // Fallback 2: Local Memory/Offline auth
    const role = (email === 'cyber.kan587@gmail.com') ? 'Admin' : 'User';
    const userObj = { uid, email, displayName: email.split('@')[0], role };
    localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
    authListeners.forEach(cb => cb(userObj));
    return userObj;
  }
};

export const logout = async () => {
  localStorage.removeItem('mock_auth_user');
  authListeners.forEach(cb => cb(null));
};

export const onAuthStateChanged = (authObj: unknown, callback: (user: AuthUser | null) => void) => {
  authListeners.push(callback);
  
  const stored = localStorage.getItem('mock_auth_user');
  if (stored) {
    try {
      callback(JSON.parse(stored));
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }
  
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
};

export const registerUserWithoutLoggingIn = async (email: string, _pass: string, name: string, role: 'User' | 'Manager' | 'Admin' = 'User') => {
  const uid = email.replace(/[^a-zA-Z0-9]/g, '_');

  if (isForceD1Active() || hasDetectedQuotaError) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: _pass || 'default', displayName: name, role })
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.user) {
          return { uid: body.user.uid, email: body.user.email, displayName: body.user.displayName, role: body.user.role };
        }
      }
    } catch (apiErr) {
      console.error('Backup API registration failed:', apiErr);
    }
    return { uid, email, displayName: name, role };
  }

  try {
    await setDoc(doc(db, 'users', uid), {
      email,
      name,
      role,
      createdAt: Date.now()
    });
    return { uid, email, displayName: name, role };
  } catch (error) {
    console.warn('Firebase registration failed, trying server API or local storage fallback...', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    }
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: _pass || 'default', displayName: name, role })
      });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.user) {
          return { uid: body.user.uid, email: body.user.email, displayName: body.user.displayName, role: body.user.role };
        }
      }
    } catch (apiErr) {
      console.error('Backup API registration failed:', apiErr);
    }
    return { uid, email, displayName: name, role };
  }
};

export interface UserPresence {
  userId: string;
  email: string;
  name: string;
  module: string;
  lastActive: number;
}

export const updatePresence = async (user: AuthUser, activeTab: string) => {
  if (isForceD1Active() || hasDetectedQuotaError) return;
  if (!user || !user.uid) return;
  const presenceRef = doc(db, 'presence', user.uid);
  try {
    await setDoc(presenceRef, {
      userId: user.uid,
      email: user.email,
      name: user.displayName || user.email?.split('@')[0] || 'Unknown',
      module: activeTab,
      lastActive: Date.now()
    }, { merge: true });
  } catch (error) {
    console.error('Failed to update presence:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    }
  }
};

export const subscribeToPresence = (callback: (presences: UserPresence[]) => void) => {
  if (isForceD1Active() || hasDetectedQuotaError) {
    callback([{
      userId: 'admin-id',
      email: 'cyber.kan587@gmail.com',
      name: 'Administrateur',
      module: 'D1 Backup Mode',
      lastActive: Date.now()
    }]);
    return () => {};
  }
  const presenceCol = collection(db, 'presence');
  return onSnapshot(presenceCol, (snapshot) => {
    const list: UserPresence[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as UserPresence;
      list.push(data);
    });
    callback(list);
  }, (error) => {
    console.error('Error listening to presence:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    }
  });
};
