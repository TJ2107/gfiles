import React, { useState } from "react";
import { loginWithEmail, registerUserWithoutLoggingIn } from "../firebase";
import { Mail, Lock, Loader2, User } from "lucide-react";

export const LoginView: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [successInfo, setSuccessInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessInfo("");
    setIsLoading(true);

    try {
      if (isRegistering) {
        const isSuperAdmin = email.toLowerCase() === "cyber.kan587@gmail.com";
        const defaultRole = isSuperAdmin ? "Admin" : "User";
        const defaultStatus = isSuperAdmin ? "approved" : "pending";

        await registerUserWithoutLoggingIn(email, password, name, defaultRole, defaultStatus);

        if (isSuperAdmin) {
          await loginWithEmail(email, password);
        } else {
          setSuccessInfo(
            "Votre demande d'inscription a été transmise avec succès ! Un administrateur doit valider votre compte et vous attribuer votre rôle avant que vous puissiez vous connecter."
          );
          setIsRegistering(false);
          setPassword("");
        }
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err: unknown) {
      console.error("Login/Register error", err);
      const errorObj = err as { code?: string; message?: string };
      setError(errorObj.message || "Erreur lors de la connexion.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-slate-800/80 p-1">
            <svg viewBox="0 0 500 500" className="w-full h-full">
              <defs>
                <radialGradient id="bg-grad-login" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#0f172a" />
                </radialGradient>

                <linearGradient id="tech-blue-login" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>

                <linearGradient id="glow-white-login" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>

                <filter id="glow-login" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Dark Tech Background Badge */}
              <circle cx="250" cy="250" r="220" fill="url(#bg-grad-login)" stroke="#38bdf8" strokeWidth="4" strokeOpacity="0.4" />
              <circle cx="250" cy="250" r="212" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.1" />

              {/* Cloud Outline */}
              <path d="M 160 280 A 45 45 0 0 1 180 195 A 65 65 0 0 1 305 175 A 50 50 0 0 1 350 250 A 40 40 0 0 1 330 320 L 170 320 A 40 40 0 0 1 160 280 Z" 
                    fill="none" 
                    stroke="url(#tech-blue-login)" 
                    strokeWidth="3" 
                    strokeDasharray="8 4"
                    opacity="0.5" />

              {/* Data Circuit Lines */}
              <g stroke="url(#tech-blue-login)" strokeWidth="2" opacity="0.6" fill="none">
                <path d="M 130 250 L 170 250 M 150 220 L 180 220 M 330 220 L 370 220 M 320 270 L 360 270" />
                <path d="M 210 140 L 210 170 M 290 135 L 290 165" />
              </g>

              {/* Main 'GF' Monogram */}
              <g filter="url(#glow-login)">
                <path d="M 225 210 C 180 200, 150 230, 150 265 C 150 305, 185 325, 225 315 L 225 270 L 195 270" 
                      fill="none" 
                      stroke="url(#glow-white-login)" 
                      strokeWidth="14" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" />

                <path d="M 265 315 L 265 210 L 325 210 M 265 260 L 310 260" 
                      fill="none" 
                      stroke="url(#tech-blue-login)" 
                      strokeWidth="14" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" />
              </g>

              {/* Data Nodes */}
              <g fill="#38bdf8">
                <circle cx="195" cy="270" r="5" />
                <circle cx="325" cy="210" r="5" />
                <circle cx="310" cy="260" r="5" />
                <circle cx="130" cy="250" r="4" />
                <circle cx="370" cy="220" r="4" />
                <circle cx="210" cy="140" r="4" />
              </g>
              <g fill="#ffffff">
                <circle cx="225" cy="210" r="5" />
                <circle cx="265" cy="315" r="5" />
              </g>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            GlobalFiles <span className="text-indigo-400">Entreprise</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Authentification sécurisée requise
          </p>
        </div>

        {successInfo && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl mb-6 text-xs leading-relaxed flex items-start gap-3 animate-in fade-in">
            <div className="mt-0.5 text-emerald-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span>{successInfo}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-start gap-3">
            <div className="mt-0.5">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isRegistering && (
            <div>
              <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
                Nom complet
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jean Dupont"
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 transition-colors placeholder:text-slate-600"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
              Adresse Email Professionnelle
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom.nom@empreintes.tech"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">
              Mot de passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block pl-11 p-3 transition-colors placeholder:text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold text-sm py-3 px-6 rounded-xl hover:bg-indigo-500 active:scale-[0.98] cursor-pointer transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/25 mt-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRegistering ? (
              "Créer le compte"
            ) : (
              "Accéder au tableau de bord"
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isRegistering
              ? "J'ai déjà un compte (Se connecter)"
              : "Je n'ai pas de compte (S'inscrire)"}
          </button>
        </div>

        <div className="text-center text-slate-500 text-xs font-medium mt-6 pt-4 border-t border-slate-800/40">
          © Empreintes Technologies 2026
        </div>
      </div>
    </div>
  );
};
