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
  status?: 'pending' | 'approved' | 'rejected';
  createdAt?: number;
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
  const isSuperAdmin = email.toLowerCase() === 'cyber.kan587@gmail.com';
  
  // 1. If quota error already detected or forced D1, use backup API first
  if (isForceD1Active() || hasDetectedQuotaError) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: _pass || 'default' })
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Erreur de connexion.");
      }
      if (body.user) {
        const userObj: AuthUser = {
          uid: body.user.uid,
          email: body.user.email,
          displayName: body.user.displayName,
          role: body.user.role,
          status: body.user.status
        };
        localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
        authListeners.forEach(cb => cb(userObj));
        return userObj;
      }
    } catch (apiErr) {
      console.error('Backup API auth failed:', apiErr);
      throw apiErr;
    }
  }

  // 2. Otherwise try standard Firebase
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    let userData = userDoc.data();
    
    let role = isSuperAdmin ? 'Admin' : 'User';
    let status: 'pending' | 'approved' | 'rejected' = isSuperAdmin ? 'approved' : 'pending';
    
    if (!userData) {
      await setDoc(doc(db, 'users', uid), {
        email,
        name: email.split('@')[0],
        role,
        status,
        createdAt: Date.now()
      });
      userData = { email, name: email.split('@')[0], role, status };
    } else {
      role = isSuperAdmin ? 'Admin' : (userData.role || 'User');
      status = isSuperAdmin ? 'approved' : (userData.status || 'pending');
    }

    if (status === 'pending') {
      throw new Error("Votre compte est en attente de validation par l'administrateur. Veuillez patienter que votre accès et rôle soient validés.");
    }
    if (status === 'rejected') {
      throw new Error("Votre demande d'inscription a été rejetée ou désactivée par l'administrateur.");
    }
    
    const userObj: AuthUser = { uid, email, displayName: userData.name || email, role, status };
    localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
    
    authListeners.forEach(cb => cb(userObj));
    return userObj;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("en attente de validation") || errMsg.includes("rejetée ou désactivée")) {
      throw error;
    }

    console.warn('Firebase login failed, trying server API fallback...', error);
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
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Erreur de connexion.");
      }
      if (body.user) {
        const userObj: AuthUser = {
          uid: body.user.uid,
          email: body.user.email,
          displayName: body.user.displayName,
          role: body.user.role,
          status: body.user.status
        };
        localStorage.setItem('mock_auth_user', JSON.stringify(userObj));
        authListeners.forEach(cb => cb(userObj));
        return userObj;
      }
    } catch (apiErr) {
      console.error('Backup API auth failed:', apiErr);
      throw apiErr;
    }

    throw error;
  }
};

export const logout = async () => {
  // 1. Clear authenticated user from localStorage
  localStorage.removeItem('mock_auth_user');
  
  // 2. Clear sensitive cached data and temporary filters
  localStorage.removeItem('cached_global_files');
  localStorage.removeItem('cached_daily_data');
  localStorage.removeItem('active_filters');
  
  // 3. Clear session storage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }

  // 4. Notify all active auth listeners
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

export const registerUserWithoutLoggingIn = async (email: string, _pass: string, name: string, role: 'User' | 'Manager' | 'Admin' = 'User', status: 'pending' | 'approved' = 'pending') => {
  const uid = email.replace(/[^a-zA-Z0-9]/g, '_');
  const isSuperAdmin = email.toLowerCase() === 'cyber.kan587@gmail.com';
  const effectiveStatus = isSuperAdmin ? 'approved' : status;
  const effectiveRole = isSuperAdmin ? 'Admin' : role;

  // 1. Save to Firestore
  try {
    await setDoc(doc(db, 'users', uid), {
      email,
      name,
      role: effectiveRole,
      status: effectiveStatus,
      createdAt: Date.now()
    }, { merge: true });
  } catch (error) {
    console.warn('Firestore user registration save failed:', error);
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    }
  }

  // 2. Always also sync with server API database
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, email, password: _pass || 'default', displayName: name, role: effectiveRole, status: effectiveStatus })
    });
    if (res.ok) {
      const body = await res.json();
      if (body.success && body.user) {
        return { uid: body.user.uid, email: body.user.email, displayName: body.user.displayName, role: body.user.role, status: body.user.status };
      }
    }
  } catch (apiErr) {
    console.warn('Server API registration sync failed:', apiErr);
  }

  return { uid, email, displayName: name, role: effectiveRole, status: effectiveStatus };
};

export const fetchAllUsers = async (): Promise<AuthUser[]> => {
  const usersMap = new Map<string, AuthUser>();

  // 1. Fetch from Firestore
  try {
    const { getDocs, collection } = await import('firebase/firestore');
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(d => {
      const data = d.data();
      const em = (data.email || d.id).toLowerCase();
      const isSuper = em === 'cyber.kan587@gmail.com';
      usersMap.set(em, {
        uid: d.id,
        email: data.email || d.id,
        displayName: data.name || data.displayName || data.email,
        role: isSuper ? 'Admin' : (data.role || 'User'),
        status: isSuper ? 'approved' : (data.status || 'pending'),
        createdAt: data.createdAt || Date.now()
      });
    });
  } catch (err) {
    console.warn("Firestore fetch users failed, falling back to server API...", err);
  }

  // 2. Fetch from Server API and merge
  try {
    const res = await fetch('/api/auth/users');
    if (res.ok) {
      const body = await res.json();
      if (body.success && Array.isArray(body.users)) {
        body.users.forEach((u: any) => {
          const em = (u.email || u.uid).toLowerCase();
          const isSuper = em === 'cyber.kan587@gmail.com';
          const existing = usersMap.get(em);
          if (!existing) {
            usersMap.set(em, {
              uid: u.uid || em.replace(/[^a-zA-Z0-9]/g, '_'),
              email: u.email,
              displayName: u.displayName || u.email,
              role: isSuper ? 'Admin' : (u.role || 'User'),
              status: isSuper ? 'approved' : (u.status || 'pending'),
              createdAt: u.createdAt || Date.now()
            });
          } else {
            // Keep the most explicit data
            if (u.status && !existing.status) existing.status = u.status;
            if (u.displayName && !existing.displayName) existing.displayName = u.displayName;
          }
        });
      }
    }
  } catch (e) {
    console.warn("Server API fetch users error:", e);
  }

  // Always ensure Super Admin is in the list
  const superEmail = 'cyber.kan587@gmail.com';
  if (!usersMap.has(superEmail)) {
    usersMap.set(superEmail, {
      uid: 'super-admin',
      email: superEmail,
      displayName: 'Administrateur Principal',
      role: 'Admin',
      status: 'approved',
      createdAt: Date.now()
    });
  }

  return Array.from(usersMap.values());
};

export const subscribeToUsers = (callback: (users: AuthUser[]) => void): () => void => {
  let unsubscribeFirestore: (() => void) | null = null;

  const handleUpdate = async () => {
    try {
      const users = await fetchAllUsers();
      callback(users);
    } catch (e) {
      console.warn("Error updating user list subscription:", e);
    }
  };

  // Initial fetch
  handleUpdate();

  // Firestore live subscription
  try {
    import('firebase/firestore').then(({ onSnapshot, collection }) => {
      unsubscribeFirestore = onSnapshot(collection(db, 'users'), () => {
        handleUpdate();
      }, (err) => {
        console.warn("Live users snapshot error:", err);
      });
    });
  } catch (e) {
    console.warn("Failed to attach live Firestore users listener:", e);
  }

  // Periodic fallback poll (every 5 seconds) to catch any server-side registrations
  const pollInterval = setInterval(handleUpdate, 5000);

  return () => {
    if (unsubscribeFirestore) unsubscribeFirestore();
    clearInterval(pollInterval);
  };
};

export const updateUserStatusAndRole = async (uid: string, role: string, status: 'pending' | 'approved' | 'rejected', email?: string): Promise<void> => {
  // 1. Update in Firestore if available
  try {
    if (uid) {
      await setDoc(doc(db, 'users', uid), {
        role,
        status
      }, { merge: true });
    }
    if (email && email.toLowerCase() !== uid.toLowerCase()) {
      await setDoc(doc(db, 'users', email.replace(/[^a-zA-Z0-9]/g, '_')), {
        role,
        status
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Firestore update user error, falling back to server API...", err);
  }

  // 2. Always sync with server API
  try {
    const target = encodeURIComponent(email || uid);
    await fetch(`/api/auth/users/${target}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, status })
    });
  } catch (err) {
    console.error("Server API update user error:", err);
  }
};

export const deleteUserAccount = async (uid: string, email?: string): Promise<void> => {
  // 1. Delete in Firestore
  try {
    const { deleteDoc } = await import('firebase/firestore');
    if (uid) {
      await deleteDoc(doc(db, 'users', uid));
    }
    if (email) {
      await deleteDoc(doc(db, 'users', email.toLowerCase()));
      await deleteDoc(doc(db, 'users', email.replace(/[^a-zA-Z0-9]/g, '_')));
    }
  } catch (err) {
    console.warn("Firestore delete user error, falling back to server API...", err);
  }

  // 2. Delete on Server
  try {
    const target = encodeURIComponent(email || uid);
    await fetch(`/api/auth/users/${target}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.error("Server API delete user error:", err);
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
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota') || errMsg.includes('Quota limit exceeded')) {
      triggerQuotaExceeded();
    } else {
      console.warn('Presence sync notice:', errMsg);
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
