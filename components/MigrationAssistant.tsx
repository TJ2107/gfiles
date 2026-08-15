import React, { useState, useEffect } from 'react';
import { Database, UploadCloud, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GlobalFileRow } from '../types';
import { saveToFirebase } from '../firebaseData';

interface MigrationAssistantProps {
  onMigrationComplete: () => void;
}

export const MigrationAssistant: React.FC<MigrationAssistantProps> = ({ onMigrationComplete }) => {
  const [localData, setLocalData] = useState<GlobalFileRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'migrating' | 'success' | 'error'>('idle');

  useEffect(() => {
    const savedData = localStorage.getItem('globalFiles_data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLocalData(parsed);
        }
      } catch (e) {
        console.error('Could not parse local data for migration.', e);
      }
    }
  }, []);

  const [progress, setProgress] = useState(0);

  const handleMigration = async () => {
    setStatus('migrating');
    try {
      // Data will be correctly saved to Firebase using chunks
      await saveToFirebase(localData, false);
      setProgress(100);

      setStatus('success');
      localStorage.removeItem('globalFiles_data'); // Clean up after successful migration
      setTimeout(() => onMigrationComplete(), 2000);

    } catch (error) {
      console.error('Migration failed:', error);
      setStatus('error');
    }
  };

  if (localData.length === 0) {
    return null; // Don't show if there's nothing to migrate
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center">
        <Database className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-slate-800">Mise à Jour de Row Data</h2>
        <p className="text-slate-500 mt-2 mb-6">
          Nous avons détecté {localData.length} enregistrements locaux. Pour finaliser la mise à jour vers notre nouvelle infrastructure Cloudflare, veuillez les migrer.
        </p>

        {status === 'idle' && (
          <button
            onClick={handleMigration}
            className="w-full px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5"
          >
            <UploadCloud className="w-5 h-5" />
            <span>Démarrer la Migration</span>
          </button>
        )}

        {status === 'migrating' && (
          <div className="w-full px-8 py-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-3 text-indigo-600 font-black">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Migration en cours... {progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="w-full px-8 py-4 bg-emerald-50 text-emerald-600 font-bold rounded-xl flex items-center justify-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>Migration terminée avec succès !</span>
          </div>
        )}

        {status === 'error' && (
           <div className="w-full p-4 bg-rose-50 text-rose-600 font-bold rounded-xl text-sm">
            <div className="flex items-center justify-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <span>La migration a échoué.</span>
            </div>
            <p className="text-xs font-medium mt-2">Veuillez rafraîchir la page et réessayer. Si le problème persiste, contactez le support.</p>
          </div>
        )}
      </div>
    </div>
  );
};
