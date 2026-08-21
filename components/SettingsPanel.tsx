import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, UserPlus, AlertTriangle, Trash2, Sun, Moon, Loader2,
  Sliders, Shield, Users, Database, Battery, Settings2, CheckCircle, Key, Mail, User, Info, AlertCircle, Activity, Monitor,
  Bell, Sparkles, Wrench, UserCheck, XCircle, Check, RefreshCw
} from 'lucide-react';
import { GlobalFileRow } from '../types';
import { 
  registerUserWithoutLoggingIn, 
  subscribeToPresence, 
  UserPresence, 
  AuthUser, 
  fetchAllUsers, 
  subscribeToUsers,
  updateUserStatusAndRole, 
  deleteUserAccount 
} from '../firebase';
import { clearFirebaseData } from '../firebaseData';

import { UserRole } from '../types';

const getModuleLabel = (moduleKey: string) => {
  switch (moduleKey) {
    case 'portal': return "Portail d'Accueil";
    case 'upload': return "Import Excel";
    case 'dashboard': return "Analyses Globales";
    case 'rapport': return "Rapport d'Activité";
    case 'data': return "Row Data";
    case 'data_pro': return "Data Pro (Vue Fluid)";
    case 'daily': return "Daily Status";
    case 'ttf': return "Analyse TTF";
    case 'gm': return "Feuille GM";
    case 'tas': return "Analyse TAS";
    case 'battery': return "Parc Batteries";
    case 'belt': return "Audit Courroies";
    case 'export': return "Pôle d'Exportation";
    case 'settings': return "Paramètres du Système";
    default: return moduleKey || "Inconnu";
  }
};

const formatLastActive = (timestamp: number) => {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 10) return "À l'instant";
  if (diff < 60) return `Il y a ${diff}s`;
  const mins = Math.floor(diff / 60);
  return `Il y a ${mins}m`;
};

interface SettingsPanelProps {
  initialBatteryThreshold: number;
  initialBeltThreshold: number;
  onSave: (batteryThreshold: number, beltThreshold: number) => void;
  data: GlobalFileRow[];
  setData: (data: GlobalFileRow[]) => void;
  onSetActiveTab: (tab: string) => void;
  isNightMode: boolean;
  setIsNightMode: (value: boolean) => void;
  themeMode?: 'light' | 'dark' | 'system';
  setThemeMode?: (value: 'light' | 'dark' | 'system') => void;
  userRole?: string | null;
  maintenanceActive?: boolean;
  setMaintenanceActive?: (value: boolean) => void;
  versionAnnounceActive?: boolean;
  setVersionAnnounceActive?: (value: boolean) => void;
  autoNightMode?: boolean;
  setAutoNightMode?: (value: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  initialBatteryThreshold,
  initialBeltThreshold,
  onSave,
  data,
  setData,
  onSetActiveTab,
  themeMode,
  setThemeMode,
  userRole,
  maintenanceActive = false,
  setMaintenanceActive,
  versionAnnounceActive = true,
  setVersionAnnounceActive,
  autoNightMode,
  setAutoNightMode
}) => {
  const isAdmin = userRole === 'Admin';
  const [activeTab, setActiveTab] = useState<'config' | 'users' | 'approvals' | 'connected' | 'danger'>('config');
  const [battery, setBattery] = useState(initialBatteryThreshold);
  const [belt, setBelt] = useState(initialBeltThreshold);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [presences, setPresences] = useState<UserPresence[]>([]);
  const [, setTick] = useState(0);

  // User management & approvals states
  const [userList, setUserList] = useState<AuthUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userActionMessage, setUserActionMessage] = useState('');
  const [pendingApprovalRoles, setPendingApprovalRoles] = useState<Record<string, UserRole>>({});
  const [userToConfirm, setUserToConfirm] = useState<{ user: AuthUser; type: 'reject' | 'delete' } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Cloudflare D1 status & health states
  const [d1Status, setD1Status] = useState<'checking' | 'online' | 'offline'>('checking');
  const [isCloudflareRemote, setIsCloudflareRemote] = useState<boolean>(false);
  const [cfErrorMessage, setCfErrorMessage] = useState<string>('');

  // Check Cloudflare D1 & Health
  useEffect(() => {
    const checkD1Health = async () => {
      try {
        const [healthRes, d1Res] = await Promise.all([
          fetch('/api/health').catch(() => null),
          fetch('/api/d1/comments').catch(() => null)
        ]);

        if (healthRes && healthRes.ok) {
          const healthData = await healthRes.json();
          setIsCloudflareRemote(!!healthData.cloudflareConfigured);
          if (healthData.cloudflareError) {
            setCfErrorMessage(healthData.cloudflareError);
          }
        }

        if (d1Res && d1Res.ok) {
          setD1Status('online');
        } else {
          setD1Status('offline');
        }
      } catch {
        setD1Status('offline');
      }
    };
    checkD1Health();
  }, []);

  const handleResetToFirebase = async () => {
    try {
      const { resetQuotaOverride } = await import('../firebaseData');
      const { resetQuotaStatus } = await import('../firebase');
      resetQuotaOverride();
      resetQuotaStatus();
    } catch {}
    localStorage.removeItem('force_d1_active');
    setShowSaveMessage(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  // Tick timer to update last active text dynamically
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Presence subscription
  useEffect(() => {
    const unsubscribe = subscribeToPresence((updatedList) => {
      const now = Date.now();
      const activeList = updatedList.filter(p => (now - p.lastActive) < 300000);
      setPresences(activeList);
    });
    return unsubscribe;
  }, []);

  // User form states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('User');
  const [addUserError, setAddUserError] = useState('');
  const [addUserSuccess, setAddUserSuccess] = useState('');
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Danger/Reset states
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Auto-hide alert notifications
  useEffect(() => {
    if (showSaveMessage) {
      const timer = setTimeout(() => setShowSaveMessage(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [showSaveMessage]);

  useEffect(() => {
    if (addUserSuccess) {
      const timer = setTimeout(() => setAddUserSuccess(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [addUserSuccess]);

  const handleSaveConfig = () => {
    onSave(battery, belt);
    setShowSaveMessage(true);
  };

  // Load users for admin management and approvals
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await fetchAllUsers();
      setUserList(users);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeToUsers((users) => {
      setUserList(users);
      setIsLoadingUsers(false);
    });
    return () => {
      unsubscribe();
    };
  }, [isAdmin]);

  const handleApproveUser = async (user: AuthUser, chosenRole?: UserRole) => {
    const roleToAssign = chosenRole || pendingApprovalRoles[user.uid] || (user.role as UserRole) || 'User';
    setUserActionMessage(`Validation de ${user.displayName || user.email}...`);
    try {
      await updateUserStatusAndRole(user.uid, roleToAssign, 'approved', user.email);
      setUserList(prev => prev.map(u => (u.uid === user.uid || (u.email && u.email.toLowerCase() === user.email?.toLowerCase())) ? { ...u, role: roleToAssign, status: 'approved' } : u));
      setUserActionMessage(`✅ Compte de "${user.displayName || user.email}" validé avec le rôle ${roleToAssign}.`);
      setTimeout(() => setUserActionMessage(''), 4500);
    } catch (e) {
      console.error(e);
      setUserActionMessage(`❌ Erreur lors de la validation du compte.`);
    }
  };

  const handlePromptReject = (user: AuthUser) => {
    setUserToConfirm({ user, type: 'reject' });
  };

  const handlePromptDelete = (user: AuthUser) => {
    setUserToConfirm({ user, type: 'delete' });
  };

  const handleExecuteUserConfirm = async () => {
    if (!userToConfirm) return;
    const { user, type } = userToConfirm;
    setIsDeletingUser(true);
    try {
      await deleteUserAccount(user.uid, user.email);
      setUserList(prev => prev.filter(u => u.uid !== user.uid && (!u.email || !user.email || u.email.toLowerCase() !== user.email.toLowerCase())));
      if (type === 'reject') {
        setUserActionMessage(`✅ Demande de "${user.displayName || user.email}" refusée et supprimée.`);
      } else {
        setUserActionMessage(`✅ Compte de "${user.displayName || user.email}" supprimé avec succès.`);
      }
      setTimeout(() => setUserActionMessage(''), 4500);
      setUserToConfirm(null);
    } catch (e) {
      console.error("Delete user execution error:", e);
      setUserActionMessage(`❌ Erreur lors de la suppression.`);
    } finally {
      setIsDeletingUser(false);
    }
  };

  const handleUpdateRole = async (user: AuthUser, newRole: UserRole) => {
    try {
      await updateUserStatusAndRole(user.uid, newRole, user.status || 'approved', user.email);
      setUserList(prev => prev.map(u => (u.uid === user.uid || (u.email && u.email.toLowerCase() === user.email?.toLowerCase())) ? { ...u, role: newRole } : u));
      setUserActionMessage(`Rôle de ${user.displayName || user.email} modifié en ${newRole}.`);
      setTimeout(() => setUserActionMessage(''), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    setAddUserSuccess('');
    setIsSubmittingUser(true);

    try {
      await registerUserWithoutLoggingIn(newUserEmail, newUserPass, newUserName, newUserRole, 'approved');

      setAddUserSuccess(`L'utilisateur "${newUserName}" a été créé et approuvé avec succès avec le rôle "${newUserRole}".`);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      setNewUserRole('User');
      setIsAddingUser(false);
      loadUsers();
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string };
      if (error.code === 'auth/email-already-in-use') {
        setAddUserError('Cet identifiant email existe déjà dans la base locale.');
      } else if (error.code === 'auth/weak-password') {
        setAddUserError('Le mot de passe doit contenir un minimum de 6 caractères.');
      } else {
        setAddUserError('Une erreur inattendue est survenue.');
      }
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleReset = async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await clearFirebaseData();
      setData([]); 
      setShowConfirmModal(false);
      onSetActiveTab('upload'); 
    } catch (e: unknown) {
      console.error("Failed to clear data", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes('resource-exhausted') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
        setDeleteError("Quota d'écriture Firestore dépassé. Veuillez réessayer demain à la réinitialisation du quota ou activer la facturation Spark/Blaze.");
      } else {
        setDeleteError("Erreur d'exécution : " + errMsg);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingUsersCount = userList.filter(u => u.status === 'pending').length;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Top Welcome & Context Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800/10 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-700/30 flex items-center justify-center shadow-inner shrink-0">
            <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-slate-700 dark:text-slate-300 animate-[spin_30s_linear_infinite]" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tighter uppercase">
              Paramètres <span className="text-slate-700 dark:text-slate-300">Système</span>
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Configurez les variables d'analyse, validez les nouveaux utilisateurs et gérez les autorisations d'accès.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 p-2 rounded-xl self-start md:self-auto shrink-0">
          <Database className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">Row Data:</span>
          <span className="font-mono bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-lg font-bold">{data.length} lignes</span>
        </div>
      </div>

      {/* Admin Panel Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
        
        {/* Navigation panel adaptive layout */}
        <div className="lg:col-span-1">
          <div className="w-full">
            {/* Desktop view sidebar */}
            <div className="hidden lg:block space-y-2">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2.5 mb-2">Sections Disponibles</p>
              <div className="space-y-1 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 p-2 rounded-xl shadow-sm">
                <button
                  onClick={() => setActiveTab('config')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'config'
                      ? 'bg-slate-950 text-slate-200 dark:bg-slate-800 border-l-[3px] border-slate-500 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configuration générale</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'approvals'
                        ? 'bg-slate-950 text-slate-200 dark:bg-slate-800 border-l-[3px] border-slate-500 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-4 h-4 text-amber-500" />
                      <span>Validation Inscriptions</span>
                    </div>
                    {pendingUsersCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-slate-950 animate-pulse">
                        {pendingUsersCount}
                      </span>
                    )}
                  </button>
                )}
                
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-slate-950 text-slate-200 dark:bg-slate-800 border-l-[3px] border-slate-500 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Gestion des Rôles & Comptes</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('connected')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    activeTab === 'connected'
                      ? 'bg-slate-950 text-slate-200 dark:bg-slate-800 border-l-[3px] border-slate-500 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Utilisateurs Connectés</span>
                  </div>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </button>
                
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('danger')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      activeTab === 'danger'
                        ? 'bg-rose-500/10 text-rose-500 border-l-[3px] border-rose-500'
                        : 'text-slate-600 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/5'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    <span>Maintenance & Danger Zone</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mobile and Tablet view horizontal tab strip */}
            <div className="lg:hidden w-full overflow-x-auto no-scrollbar pb-1 mb-2">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200/55 dark:border-slate-900 rounded-xl space-x-1 min-w-[340px]">
                <button
                  onClick={() => setActiveTab('config')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'config'
                      ? 'bg-white dark:bg-slate-900 text-indigo-500 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-800/60'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Seuils</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('approvals')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer relative ${
                      activeTab === 'approvals'
                        ? 'bg-white dark:bg-slate-900 text-amber-500 shadow-sm border border-slate-200/40 dark:border-slate-800/60'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Validation</span>
                    {pendingUsersCount > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-amber-500 text-slate-950">
                        {pendingUsersCount}
                      </span>
                    )}
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-white dark:bg-slate-900 text-indigo-500 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-800/60'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Comptes</span>
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('connected')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'connected'
                      ? 'bg-white dark:bg-slate-900 text-indigo-500 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-800/60'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Connectés</span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('danger')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'danger'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'text-slate-500 dark:text-slate-400 hover:text-rose-500'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Maintenance</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Panel Area */}
        <div className="lg:col-span-3">
          
          {/* Subheader Title */}
          <div className="mb-4 sm:mb-5 flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-950 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
              {activeTab === 'config' && (
                <>
                  <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                  <span>Seuils Analytiques & Préférences visuelles</span>
                </>
              )}
              {activeTab === 'approvals' && (
                <>
                  <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Validation & Approbation des Inscriptions</span>
                </>
              )}
              {activeTab === 'users' && (
                <>
                  <Users className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
                  <span>Comptes & Droits d'Accès d'Équipe</span>
                </>
              )}
              {activeTab === 'connected' && (
                <>
                  <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Agents d'Équipe Connectés en Temps Réel</span>
                </>
              )}
              {activeTab === 'danger' && (
                <>
                  <Shield className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                  <span>Zone d'Administration Critique</span>
                </>
              )}
            </h3>
            {(activeTab === 'approvals' || activeTab === 'users') && (
              <button
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors"
                title="Actualiser la liste"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-slate-700' : ''}`} />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-sm min-h-[380px] flex flex-col justify-between">
            
            {/* TAB 1: GENERAL CONFIGURATION */}
            {activeTab === 'config' && (
              <div className="space-y-6 w-full">
                
                {/* Save Success Banner */}
                {showSaveMessage && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-3 duration-200">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Seuils analytiques et préférences modifiés avec succès.</span>
                  </div>
                )}

                {/* Theme Section */}
                <div className="p-5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                        <Sun className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        <span>Ajuster le Thème Visuel</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                        Sélectionnez un thème fixe ou activez le mode appareil pour synchroniser automatiquement l'interface de l'application avec les préférences de votre système d'exploitation.
                      </p>
                    </div>
                    
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl space-x-1 shrink-0 self-start md:self-auto">
                      <button
                        onClick={() => {
                          if (setThemeMode) {
                            setThemeMode('light');
                            localStorage.setItem('theme_mode', 'light');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          (themeMode || 'system') === 'light'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Clair</span>
                      </button>
                      <button
                        onClick={() => {
                          if (setThemeMode) {
                            setThemeMode('dark');
                            localStorage.setItem('theme_mode', 'dark');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          (themeMode || 'system') === 'dark'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Nuit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (setThemeMode) {
                            setThemeMode('system');
                            localStorage.setItem('theme_mode', 'system');
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          (themeMode || 'system') === 'system'
                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Mode Appareil</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto Night Mode schedule option */}
                  <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Appliquer automatiquement entre 20h00 et 06h00</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Bascule automatiquement sur le mode nuit pendant les heures nocturnes.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={autoNightMode || false} 
                        onChange={(e) => {
                          if (setAutoNightMode) {
                            setAutoNightMode(e.target.checked);
                            localStorage.setItem('auto_night_mode', String(e.target.checked));
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-slate-700"></div>
                    </label>
                  </div>
                </div>

                {/* Communication aux Utilisateurs (Only Admin) */}
                {isAdmin && (
                  <div className="p-5 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-5 animate-in fade-in duration-300">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                          Communication & Information Utilisateurs
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                        Gérez la publication des notifications système et l'état opérationnel de la plateforme pour tous les agents.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {/* Sub-item: Version Announce */}
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/60 rounded-xl flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-slate-850 dark:text-slate-200">Bandeau de Nouvelle Version</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Affiche un bandeau d'actualité élégant signalant le déploiement de la version <strong>v3.6.0</strong> (mode nuit raffiné et planification automatique).
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {versionAnnounceActive ? "Actif (Visible)" : "Inactif"}
                          </span>
                          <button
                            onClick={() => {
                              const newVal = !versionAnnounceActive;
                              if (setVersionAnnounceActive) {
                                setVersionAnnounceActive(newVal);
                                if (newVal) {
                                  localStorage.removeItem('version_announce_dismissed');
                                } else {
                                  localStorage.setItem('version_announce_dismissed', 'v3.6.0');
                                }
                              }
                            }}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              versionAnnounceActive ? 'bg-slate-700' : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                            role="switch"
                            aria-checked={versionAnnounceActive}
                            type="button"
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                versionAnnounceActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Sub-item: Maintenance Toggle */}
                      <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-800/60 rounded-xl flex flex-col justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Wrench className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                            <span className="text-xs font-bold text-slate-850 dark:text-slate-200">Mode Maintenance Planifiée</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            Restreint l'accès aux utilisateurs réguliers avec une page de maintenance dédiée. Les administrateurs conservent leur accès pour superviser les ajustements.
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {maintenanceActive ? "Activé" : "Désactivé"}
                          </span>
                          <button
                            onClick={() => {
                              const newVal = !maintenanceActive;
                              if (setMaintenanceActive) {
                                setMaintenanceActive(newVal);
                                localStorage.setItem('maintenance_active', String(newVal));
                              }
                            }}
                            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              maintenanceActive ? 'bg-slate-700' : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                            role="switch"
                            aria-checked={maintenanceActive}
                            type="button"
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                maintenanceActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pre-visualization of Maintenance Message */}
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-950/40 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">Message Officiel de Maintenance</span>
                      </div>
                      <p className="text-[10.5px] text-slate-700 dark:text-slate-300 font-medium italic leading-relaxed">
                        "Le site est actuellement en cours de maintenance planifiée pour l'optimisation des performances de la base de données. Nos équipes techniques s'efforcent de rétablir l'accès complet dans les plus brefs délais. Merci de votre patience."
                      </p>
                    </div>
                  </div>
                )}

                {/* Cloudflare D1 forced bypass and diagnostic (Only Admin) */}
                {isAdmin && (
                  <div className="p-5 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Database className="w-5 h-5 text-sky-500" />
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                            Architecture Double Base : Cloudflare D1 (Principale) + Firestore (Secondaire)
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                          <strong>Cloudflare D1</strong> est configurée comme votre base de données principale prioritaire. <strong>Firebase Firestore</strong> opère en tant que base secondaire pour la réplication et la redondance multi-niveaux.
                        </p>
                      </div>

                      {/* Dual DB Badges */}
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                        {/* Cloudflare Badge (Primary) */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400">
                          {isCloudflareRemote ? (
                            <>
                              <span className="flex h-1.5 w-1.5 rounded-full bg-sky-500 animate-ping"></span>
                              <span className="text-[10px] font-bold uppercase tracking-wider">Cloudflare D1 : Principale</span>
                            </>
                          ) : (
                            <>
                              <span className={`flex h-1.5 w-1.5 rounded-full ${d1Status === 'online' ? 'bg-sky-500' : 'bg-amber-500'}`}></span>
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                {d1Status === 'online' ? 'Cloudflare D1 : Principale' : 'D1 : Initialisation...'}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Firestore Badge (Secondary) */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200/65 dark:border-slate-800">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-red-500"></span>
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Firestore : Réplication</span>
                        </div>
                      </div>
                    </div>

                    {cfErrorMessage && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{cfErrorMessage}</span>
                      </div>
                    )}

                    {/* Info bar */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Hiérarchie & Priorité des Requêtes
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-lg leading-relaxed">
                          Toutes les lectures et écritures s'exécutent en priorité absolue sur Cloudflare D1. Firestore reçoit une copie répliquée en tâche de fond pour garantir la redondance et la sécurité de vos données.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={handleResetToFirebase}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] rounded-lg transition active:scale-95 shadow-sm"
                          title="Réinitialiser l'état des connexions et vérifier la synchronisation"
                        >
                          Synchroniser / Réinitialiser
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Threshold Configuration (Only Admin) */}
                {isAdmin ? (
                  <div className="space-y-6 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                      
                      {/* Battery Card */}
                      <div className="p-4 sm:p-5 border border-slate-200/65 dark:border-slate-800/80 rounded-xl space-y-3 hover:border-indigo-500/10 dark:hover:border-indigo-500/20 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="bg-indigo-500/10 p-1.5 rounded-lg shrink-0">
                              <Battery className="w-4 h-4 text-indigo-500" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Alerte Seuil Batterie</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">Fixe le seuil en mois à partir duquel la batterie du site sera mise en exergue pour remplacement.</p>
                        </div>
                        
                        <div className="relative pt-2">
                          <span className="absolute right-3.5 top-[19px] text-[10px] font-black text-slate-400 dark:text-slate-400">MOIS</span>
                          <input 
                            type="number" 
                            value={battery} 
                            min={1}
                            max={120}
                            onChange={(e) => setBattery(Math.max(1, parseInt(e.target.value) || 0))} 
                            className="w-full pl-3.5 pr-14 py-2 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-colors" 
                          />
                        </div>
                      </div>

                      {/* Belt Card */}
                      <div className="p-4 sm:p-5 border border-slate-200/65 dark:border-slate-800/80 rounded-xl space-y-3 hover:border-indigo-500/10 dark:hover:border-indigo-500/20 transition-all flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="bg-indigo-500/10 p-1.5 rounded-lg shrink-0">
                              <Settings2 className="w-4 h-4 text-indigo-500" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">Alerte Seuil Courroie</h4>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mt-2">Fixe l'intervalle d'échéance critique (en jours) recommandé pour planifier l'audit des courroies.</p>
                        </div>
                        
                        <div className="relative pt-2">
                          <span className="absolute right-3.5 top-[19px] text-[10px] font-black text-slate-400 dark:text-slate-400">JOURS</span>
                          <input 
                            type="number" 
                            value={belt} 
                            min={1}
                            max={3650}
                            onChange={(e) => setBelt(Math.max(1, parseInt(e.target.value) || 0))} 
                            className="w-full pl-3.5 pr-16 py-2 dark:text-slate-200 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-colors" 
                          />
                        </div>
                      </div>

                    </div>

                    <div className="pt-4 flex justify-end border-t border-slate-100 dark:border-slate-800 mt-4">
                      <button 
                        onClick={handleSaveConfig} 
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/15 duration-200 active:scale-95 transition-transform"
                      >
                         <Save className="w-4 h-4" /> 
                         <span>Mettre à jour la Configuration</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/30 border border-slate-200/60 dark:border-slate-800 rounded-xl mt-4">
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed italic">
                      💡 Vous êtes actuellement connecté en mode collaborateur. Les détails critiques de calibrage des seuils batteries et courroies sont modifiables exclusivement par les administrateurs systèmes.
                    </p>
                  </div>
                )}

              </div>
            )}

            {/* TAB: APPROVALS & REGISTRATION VALIDATION */}
            {isAdmin && activeTab === 'approvals' && (
              <div className="space-y-6 w-full animate-in fade-in duration-300">
                {userActionMessage && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{userActionMessage}</span>
                  </div>
                )}

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                      Inscriptions en attente de validation
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Pour garantir la sécurité et la qualification des intervenants, chaque nouvelle création de compte nécessite la validation d'un administrateur ainsi que l'attribution d'un rôle d'accès.
                    </p>
                  </div>
                  
                  <div className="px-3 py-1.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-black self-start sm:self-auto flex items-center gap-2 shrink-0">
                    <span>{pendingUsersCount} en attente</span>
                  </div>
                </div>

                <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          <th className="p-4">Demandeur / Identité</th>
                          <th className="p-4">Email</th>
                          <th className="p-4">Rôle à attribuer</th>
                          <th className="p-4 text-right">Actions de validation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {isLoadingUsers ? (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                              <span>Chargement des demandes d'inscription...</span>
                            </td>
                          </tr>
                        ) : userList.filter(u => u.status === 'pending').length > 0 ? (
                          userList.filter(u => u.status === 'pending').map((pendingUser) => (
                            <tr key={pendingUser.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center uppercase border border-amber-500/20 shrink-0">
                                  {pendingUser.displayName ? pendingUser.displayName[0] : (pendingUser.email ? pendingUser.email[0] : 'U')}
                                </div>
                                <div>
                                  <p className="font-extrabold text-slate-900 dark:text-slate-100">{pendingUser.displayName || "Nouvel Utilisateur"}</p>
                                  <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                    En attente d'approbation
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                {pendingUser.email}
                              </td>
                              <td className="p-4">
                                <select
                                  value={pendingApprovalRoles[pendingUser.uid] || pendingUser.role || 'User'}
                                  onChange={(e) => {
                                    const r = e.target.value as UserRole;
                                    setPendingApprovalRoles(prev => ({ ...prev, [pendingUser.uid]: r }));
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-indigo-500"
                                >
                                  <option value="User">Utilisateur (Lecteur - Terrain)</option>
                                  <option value="FE">Field Engineer (FE - Terrain)</option>
                                  <option value="Manager">Manager (Superviseur)</option>
                                  <option value="Admin">Administrateur</option>
                                </select>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleApproveUser(pendingUser)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Valider l'accès</span>
                                  </button>
                                  <button
                                    onClick={() => handlePromptReject(pendingUser)}
                                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                    title="Refuser et supprimer la demande"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Refuser</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500">
                              <CheckCircle className="w-8 h-8 text-emerald-500/40 mx-auto mb-2" />
                              <p className="font-bold text-slate-700 dark:text-slate-300">Toutes les demandes ont été traitées</p>
                              <p className="text-[10px] mt-0.5">Aucun nouvel utilisateur en attente de qualification actuellement.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: USER MANAGEMENT & ACTIVE ACCOUNTS */}
            {isAdmin && activeTab === 'users' && (
              <div className="space-y-6 w-full animate-in fade-in duration-300">
                
                {addUserSuccess && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2 duration-200">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{addUserSuccess}</span>
                  </div>
                )}

                {userActionMessage && (
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{userActionMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  
                  {/* Left guide explaining Roles & Access tiers */}
                  <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950/40 p-4 sm:p-5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      Rôles disponibles & Privilèges
                    </h4>
                    
                    <div className="space-y-3.5 text-[11px] leading-relaxed">
                      <div className="border-l-2 border-slate-300 dark:border-slate-700 pl-3">
                        <span className="font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">Utilisateur & FE (Terrain)</span>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">Accès ciblé aux modules Daily Status, Parc Batteries, Audit Courroies et Guide d'Utilisation.</p>
                      </div>
                      
                      <div className="border-l-2 border-teal-500 dark:border-teal-400 pl-3">
                        <span className="font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Manager (Superviseur)</span>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">Accès à tous les modules d'analyse, prédictions et rapports (hors module d'importation Excel).</p>
                      </div>

                      <div className="border-l-2 border-indigo-600 pl-3">
                        <span className="font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">Administrateur</span>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">Privilèges complets : Importation Excel, validation des accès, gestion des utilisateurs et configuration système.</p>
                      </div>
                    </div>
                  </div>

                  {/* Form section */}
                  <div className="md:col-span-7 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Ajouter un utilisateur directement</h4>
                      <button 
                        onClick={() => setIsAddingUser(!isAddingUser)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors shrink-0 ${
                          isAddingUser 
                            ? 'bg-rose-500/10 hover:bg-rose-500/15 border-rose-500/20 text-rose-500' 
                            : 'bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-500'
                        }`}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isAddingUser ? 'Annuler' : 'Créer un compte validé'}</span>
                      </button>
                    </div>

                    {isAddingUser && (
                      <form onSubmit={handleAddUser} className="space-y-4 border border-indigo-500/10 dark:border-indigo-500/15 bg-indigo-500/5 p-4 sm:p-5 rounded-xl">
                        {addUserError && (
                          <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-950 text-[11px] font-bold rounded-lg flex items-center gap-2 animate-shake">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                            <span>{addUserError}</span>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Nom complet</label>
                            <div className="relative">
                              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                              <input 
                                type="text" 
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                required
                                className="w-full pl-9 pr-3 py-2 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 text-xs rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="Jean Dupont"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Adresse Email</label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                              <input 
                                type="email" 
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                required
                                className="w-full pl-9 pr-3 py-2 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 text-xs rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="jean.dupont@email.com"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Mot de passe</label>
                            <div className="relative">
                              <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                              <input 
                                type="password" 
                                value={newUserPass}
                                onChange={(e) => setNewUserPass(e.target.value)}
                                required
                                minLength={6}
                                className="w-full pl-9 pr-3 py-2 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 text-xs rounded-lg focus:outline-none focus:border-indigo-500"
                                placeholder="Minim. 6 carac."
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Rôle d'Accès</label>
                            <select 
                              value={newUserRole}
                              onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                              className="w-full px-3 py-2 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 text-xs rounded-lg focus:outline-none focus:border-indigo-500"
                            >
                              <option value="User">Utilisateur (Lecteur - Terrain)</option>
                              <option value="FE">Field Engineer (FE - Terrain)</option>
                              <option value="Manager">Manager (Superviseur)</option>
                              <option value="Admin">Administrateur (Complet)</option>
                            </select>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <button 
                            type="submit"
                            disabled={isSubmittingUser}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg disabled:opacity-50 flex items-center justify-center cursor-pointer duration-200 active:scale-95"
                          >
                            {isSubmittingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Créer et approuver le compte'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                </div>

                {/* Table of all active approved users */}
                <div className="mt-8 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>Répertoire des Utilisateurs Actifs ({userList.filter(u => u.status === 'approved').length})</span>
                  </h4>

                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            <th className="p-4">Utilisateur</th>
                            <th className="p-4">Email</th>
                            <th className="p-4">Rôle Attribué</th>
                            <th className="p-4">Statut</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                          {isLoadingUsers ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                                <span>Chargement de la liste des utilisateurs...</span>
                              </td>
                            </tr>
                          ) : userList.filter(u => u.status === 'approved').length > 0 ? (
                            userList.filter(u => u.status === 'approved').map((user) => {
                              const isSuperAdminUser = user.email?.toLowerCase() === 'cyber.kan587@gmail.com';
                              return (
                                <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                                  <td className="p-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center uppercase border border-indigo-500/20 shrink-0">
                                      {user.displayName ? user.displayName[0] : (user.email ? user.email[0] : 'U')}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-slate-900 dark:text-slate-100">{user.displayName || "Collaborateur"}</p>
                                      {isSuperAdminUser && (
                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">Super Admin</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                                    {user.email}
                                  </td>
                                  <td className="p-4">
                                    {isSuperAdminUser ? (
                                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                                        Admin Principal
                                      </span>
                                    ) : (
                                      <select
                                        value={user.role || 'User'}
                                        onChange={(e) => handleUpdateRole(user, e.target.value as UserRole)}
                                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold rounded-lg focus:outline-none focus:border-indigo-500"
                                      >
                                        <option value="User">Utilisateur (Lecteur)</option>
                                        <option value="Manager">Manager (Superviseur)</option>
                                        <option value="Admin">Administrateur</option>
                                      </select>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/30">
                                      <CheckCircle className="w-3 h-3" />
                                      Approuvé
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    {!isSuperAdminUser && (
                                      <button
                                        onClick={() => handlePromptDelete(user)}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                        title="Supprimer l'utilisateur"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400">
                                Aucun utilisateur actif trouvé.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: DANGER ZONE */}
            {isAdmin && activeTab === 'danger' && (
              <div className="space-y-6 w-full">
                
                <div className="p-4 sm:p-5 bg-rose-500/5 border border-rose-500/10 dark:border-rose-950/10 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-rose-500/10 p-1.5 rounded-lg shrink-0">
                      <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                    </div>
                    <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">Attention: Actions Irréversibles</h4>
                  </div>
                  
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Les fonctions ci-dessous écrasent ou vident l'ensemble des données d'importation Excel actuelles. Assurez-vous d'avoir téléchargé une sauvegarde locale des feuilles .xlsx depuis le pôle d'exportation avant toute action radicale.
                  </p>
                </div>

                <div className="p-4 sm:p-5 border border-rose-200 dark:border-rose-900/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Purger le Système</h5>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Efface toutes les données de la base Firestore et remet l'application à zéro.</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setDeleteError('');
                      setShowConfirmModal(true);
                    }} 
                    className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/15 duration-150 active:scale-95 transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> 
                    <span>Réinitialiser la base</span>
                  </button>
                </div>

                {deleteError && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-950 font-semibold text-xs space-y-2">
                    <p>{deleteError}</p>
                    {deleteError.includes('Quota') && (
                      <p className="text-[10px] text-slate-500 leading-normal">
                        ℹ️ Plus d'informations sur les limites de comptage d'écritures gratuites Spark dans la{' '}
                        <a href="https://console.firebase.google.com/project/project-79ae2089-3125-4bde-8b5/firestore/databases/ai-studio-e87dc6c2-35c4-4d15-8ac6-32dd9a0a01fa/data" target="_blank" rel="noopener noreferrer" className="underline font-bold text-rose-800 hover:text-rose-900">
                          Console Firebase
                        </a>.
                      </p>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: CONNECTED USERS Presence */}
            {activeTab === 'connected' && (
              <div className="space-y-6 w-full animate-in fade-in duration-300">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      Statut d'Activité en Ligne
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      La liste ci-dessous montre tous les collaborateurs actifs sur la plateforme en temps réel (actualisation automatique).
                    </p>
                  </div>
                  
                  <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold self-start sm:self-auto flex items-center gap-2 shrink-0">
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{presences.length} utilisateur(s) actif(s)</span>
                  </div>
                </div>

                <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-150 dark:border-slate-800 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          <th className="p-4">Collaborateur / Email</th>
                          <th className="p-4">Module Actuel</th>
                          <th className="p-4">Dernière Connexion</th>
                          <th className="p-4 text-center">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {presences.length > 0 ? (
                          presences.map((presence) => (
                            <tr key={presence.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                              <td className="p-4 flex items-center gap-3">
                                <div className="relative w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center uppercase border border-indigo-500/10 shrink-0">
                                  {presence.email ? presence.email[0] : 'U'}
                                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-extrabold text-slate-800 dark:text-slate-200 truncate">{presence.name || "Collaborateur"}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{presence.email || "cyber.kan587@gmail.com"}</p>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black uppercase tracking-wider">
                                  {getModuleLabel(presence.module)}
                                </span>
                              </td>
                              <td className="p-4 font-bold text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                                {formatLastActive(presence.lastActive)}
                              </td>
                              <td className="p-4 text-center">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-100 dark:border-emerald-900/30">
                                  Connecté
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-slate-500">
                              <Users className="w-8 h-8 text-indigo-400/20 mx-auto mb-2" />
                              <p className="font-bold">Aucun autre utilisateur en ligne</p>
                              <p className="text-[10px] mt-0.5">Seul votre compte est actuellement répertorié.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* USER ACTION CONFIRMATION MODAL */}
      {userToConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => !isDeletingUser && setUserToConfirm(null)}></div>
          
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 sm:p-6 max-w-md w-full border border-slate-200/50 dark:border-slate-800/80 animate-in zoom-in-95 duration-200 z-10">
            <h4 className="text-sm sm:text-md font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 mb-3">
              {userToConfirm.type === 'reject' ? (
                <>
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>Refuser la demande d'inscription</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>Supprimer l'accès utilisateur</span>
                </>
              )}
            </h4>
            
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mb-4">
              {userToConfirm.type === 'reject' ? (
                <>
                  Êtes-vous sûr de vouloir rejeter et supprimer la demande d'inscription pour <strong className="text-slate-800 dark:text-slate-100 font-bold">"{userToConfirm.user.displayName || userToConfirm.user.email}"</strong> ({userToConfirm.user.email}) ?
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir révoquer l'accès et supprimer définitivement le compte de <strong className="text-slate-800 dark:text-slate-100 font-bold">"{userToConfirm.user.displayName || userToConfirm.user.email}"</strong> ({userToConfirm.user.email}) ?
                </>
              )}
            </p>

            <div className="flex gap-2 justify-end mt-6">
              <button
                disabled={isDeletingUser}
                onClick={() => setUserToConfirm(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition text-xs cursor-pointer"
              >
                Annuler
              </button>
              
              <button
                disabled={isDeletingUser}
                onClick={handleExecuteUserConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-rose-600/15"
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Traitement en cours...</span>
                  </>
                ) : userToConfirm.type === 'reject' ? (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Oui, refuser</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Oui, supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => !isDeleting && setShowConfirmModal(false)}></div>
          
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 sm:p-6 max-w-md w-full border border-slate-200/50 dark:border-slate-800/80 animate-in zoom-in-95 duration-200 z-10">
            <h4 className="text-sm sm:text-md font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <span>Confirmer la suppression</span>
            </h4>
            
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed mb-6">
              Êtes-vous absolument sûr de vouloir purger définitivement <strong className="text-slate-800 dark:text-slate-100">l'ensemble des données d'importation</strong>? Toute modification est immédiate et se propage sur vos dashboards d'équipe.
            </p>
            
            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-bold mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                disabled={isDeleting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-lg transition text-xs cursor-pointer"
              >
                Annuler
              </button>
              
              <button
                disabled={isDeleting}
                onClick={handleReset}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-md shadow-rose-600/15"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purge en cours...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Oui, purger</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
