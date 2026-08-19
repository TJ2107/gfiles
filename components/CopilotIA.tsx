import React, { useState } from 'react';
import { GlobalFileRow } from '../types';
import { Sparkles, Bot, ArrowRight, Loader2, Wand2, MessageSquare, Zap } from 'lucide-react';

interface CopilotIAProps {
  data: GlobalFileRow[];
  isOpen: boolean;
  onClose: () => void;
  onApplyCategory?: (rowId: string, updates: Partial<GlobalFileRow>) => void;
}

export const CopilotIA: React.FC<CopilotIAProps> = ({ data, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'query' | 'categorize'>('query');
  
  // Natural Language Search state
  const [userQuery, setUserQuery] = useState('');
  const [queryAnswer, setQueryAnswer] = useState<string | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);

  // Auto-Categorization state
  const [descInput, setDescInput] = useState('');
  const [siteInput, setSiteInput] = useState('');
  const [regionInput, setRegionInput] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<{
    stateX?: string;
    pmType?: string;
    recommendedTechnician?: string;
    urgency?: string;
    reasoning?: string;
  } | null>(null);
  const [isCatLoading, setIsCatLoading] = useState(false);

  if (!isOpen) return null;

  const handleQuerySubmit = async (queryText?: string) => {
    const q = queryText || userQuery;
    if (!q.trim()) return;
    setIsQueryLoading(true);
    setQueryAnswer(null);

    try {
      // Send a lightweight representation of the dataset
      const sample = data.slice(0, 100).map(r => ({
        swo: r["N° SWO"],
        site: r["Nom du site"],
        region: r["Region"],
        stateX: r["X"] || r["State SWO"],
        desc: r["Description"] || r["Short description"],
        date: r["Date de création du SWO"] || r["PM Date"],
        assigned: r["Assigned to"] || r["Intervenant"],
        swapBat: r["SWAP BATTERIE"],
        swapBelt: r["SWAP COURROIE"]
      }));

      const res = await fetch('/api/gemini/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, datasetSummary: sample })
      });
      const json = await res.json();
      if (json.success) {
        setQueryAnswer(json.answer);
      } else {
        setQueryAnswer("Désolé, une erreur est survenue lors de la consultation de l'assistant IA.");
      }
    } catch {
      setQueryAnswer("Erreur de connexion au serveur Gemini Copilot.");
    } finally {
      setIsQueryLoading(false);
    }
  };

  const handleCategorizeSubmit = async () => {
    if (!descInput.trim()) return;
    setIsCatLoading(true);
    setAiSuggestion(null);

    try {
      const res = await fetch('/api/gemini/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: descInput,
          siteName: siteInput,
          region: regionInput
        })
      });
      const json = await res.json();
      if (json.success && json.suggestion) {
        setAiSuggestion(json.suggestion);
      }
    } catch {
      setAiSuggestion({
        stateX: "Non commencé",
        pmType: "Dépannage Général",
        recommendedTechnician: "Équipe Intervention",
        urgency: "Normale",
        reasoning: "Analyse locale suite à un problème réseau."
      });
    } finally {
      setIsCatLoading(false);
    }
  };

  const quickPrompts = [
    "Donne-moi la liste des sites qui ont subi plus de 2 changements de batteries ce mois-ci",
    "Quels sont les SWO critiques ouverts depuis plus de 72 heures ?",
    "Analyse les problèmes de climatisation et PM Aircon les plus fréquents",
    "Synthèse des interventions par région et charge de travail"
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
        
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 backdrop-blur border border-indigo-400/30 rounded-xl">
              <Sparkles className="w-6 h-6 text-indigo-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg tracking-tight">Copilot Maintenance IA</h3>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 bg-indigo-400/20 text-indigo-200 rounded-full border border-indigo-300/30">Gemini 3.7</span>
              </div>
              <p className="text-xs text-indigo-200 font-medium">Assistant prédictif et recherche en langage naturel</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1.5 gap-2">
          <button
            onClick={() => setActiveTab('query')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'query'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Recherche Langage Naturel
          </button>
          <button
            onClick={() => setActiveTab('categorize')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'categorize'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Auto-Catégorisation IA
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {activeTab === 'query' ? (
            <div className="space-y-6">
              
              {/* Quick Prompts */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-2">Exemples de questions fréquentes :</label>
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setUserQuery(prompt);
                        handleQuerySubmit(prompt);
                      }}
                      className="text-left text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-slate-700 dark:text-slate-300 transition-all flex items-center justify-between group"
                    >
                      <span>{prompt}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Query */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400">Posez votre question sur la base de données :</label>
                <div className="relative">
                  <textarea
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder="Ex: Donne-moi la liste des sites qui ont eu plus de 2 changements de batteries ce mois-ci..."
                    className="w-full p-4 text-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[100px] resize-y"
                  />
                  <button
                    onClick={() => handleQuerySubmit()}
                    disabled={isQueryLoading || !userQuery.trim()}
                    className="mt-2 w-full py-3 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isQueryLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyse par Gemini 3.7 Flash...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Interroger le Copilot IA
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Result Answer */}
              {queryAnswer && (
                <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
                    <Bot className="w-4 h-4" />
                    Réponse de Gemini Copilot
                  </div>
                  <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-medium">
                    {queryAnswer}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Auto-Categorization Tab */
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black text-xs uppercase">
                  <Zap className="w-4 h-4 text-indigo-500" />
                  Saisie d'incident à pré-catégoriser
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description de la panne ou de l'intervention :</label>
                  <textarea
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="Ex: Groupe électrogène en fuite d'huile avec alerte batterie faible et filtre encrassé..."
                    className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nom du Site (Optionnel) :</label>
                    <input
                      type="text"
                      value={siteInput}
                      onChange={(e) => setSiteInput(e.target.value)}
                      placeholder="Ex: Site Dakar Plateau"
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Région (Optionnel) :</label>
                    <input
                      type="text"
                      value={regionInput}
                      onChange={(e) => setRegionInput(e.target.value)}
                      placeholder="Ex: DAKAR"
                      className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCategorizeSubmit}
                  disabled={isCatLoading || !descInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-xl hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCatLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyse prédictive en cours...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4" />
                      Prédire la Catégorisation avec l'IA
                    </>
                  )}
                </button>
              </div>

              {/* AI Suggestion Card */}
              {aiSuggestion && (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200 dark:border-purple-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      Recommandation de Catégorisation
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      aiSuggestion.urgency === 'Critique' || aiSuggestion.urgency === 'Haute'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}>
                      Urgence : {aiSuggestion.urgency || 'Normale'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900">
                      <span className="block text-[10px] font-extrabold text-slate-400 uppercase">État X suggéré</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{aiSuggestion.stateX}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900">
                      <span className="block text-[10px] font-extrabold text-slate-400 uppercase">Type de PM</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{aiSuggestion.pmType}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-purple-100 dark:border-purple-900">
                      <span className="block text-[10px] font-extrabold text-slate-400 uppercase">Intervenant Préconisé</span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">{aiSuggestion.recommendedTechnician}</span>
                    </div>
                  </div>

                  {aiSuggestion.reasoning && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium italic pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                      💡 {aiSuggestion.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
