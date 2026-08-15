
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-2xl w-full bg-white rounded-[3rem] shadow-2xl border border-rose-100 p-12 text-center space-y-8 animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto border-4 border-rose-100">
              <AlertTriangle className="w-12 h-12 text-rose-500" />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                Oups ! <span className="text-rose-600">Erreur Critique</span>
              </h1>
              <p className="text-slate-500 font-medium text-lg leading-relaxed">
                Une erreur inattendue est survenue lors de l'analyse des données. 
                Ne vous inquiétez pas, vos fichiers sont en sécurité.
              </p>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl text-left border border-slate-100 overflow-hidden">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Détails Techniques</p>
              <code className="text-xs text-rose-600 font-mono break-all block">
                {this.state.error?.message || 'Erreur inconnue'}
              </code>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/20"
              >
                <RefreshCcw className="w-4 h-4" /> Recharger l'application
              </button>
              <button 
                onClick={() => this.setState({ hasError: false })}
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <Home className="w-4 h-4" /> Retour à l'accueil
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
