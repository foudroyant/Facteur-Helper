/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Settings, Lock, Send, CheckCircle2, AlertCircle, LogOut, Key, History, Download, Trash2, X, Cpu, ScanLine, Tag, Plus, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';

// Types
interface AppSettings {
  apiKey: string;
  password: string;
}

interface Label {
  id: string;
  name: string;
  timestamp: string;
}

interface ExtractionResult {
  id: string;
  labelId: string;
  timestamp: string;
  nomComplet: string;
  appartement: string;
  adresse: string;
  rawResponse?: string;
}

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(true);
  const [editingResult, setEditingResult] = useState<Partial<ExtractionResult> | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '',
    password: '',
  });
  const [labels, setLabels] = useState<Label[]>([]);
  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [history, setHistory] = useState<ExtractionResult[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Load settings and history from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('facteur_helper_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setIsInitialized(!!parsed.password);
    } else {
      setIsInitialized(false);
    }

    const savedHistory = localStorage.getItem('facteur_helper_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const savedLabels = localStorage.getItem('facteur_helper_labels');
    if (savedLabels) {
      setLabels(JSON.parse(savedLabels));
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    localStorage.setItem('facteur_helper_settings', JSON.stringify(newSettings));
    setSettings(newSettings);
    setIsInitialized(true);
    setIsAuthenticated(true);
    setShowSettings(false);
  };

  const saveToHistory = (results: Omit<ExtractionResult, 'id' | 'timestamp' | 'labelId'> | Omit<ExtractionResult, 'id' | 'timestamp' | 'labelId'>[]) => {
    if (!activeLabelId) return;
    
    const resultsArray = Array.isArray(results) ? results : [results];
    const newEntries: ExtractionResult[] = resultsArray.map(result => ({
      ...result,
      id: crypto.randomUUID(),
      labelId: activeLabelId,
      timestamp: new Date().toISOString(),
    }));
    
    setHistory(prev => {
      const updated = [...newEntries, ...prev];
      localStorage.setItem('facteur_helper_history', JSON.stringify(updated));
      return updated;
    });
  };

  const addLabel = (name: string) => {
    const newLabel: Label = {
      id: crypto.randomUUID(),
      name,
      timestamp: new Date().toISOString(),
    };
    const updatedLabels = [newLabel, ...labels];
    setLabels(updatedLabels);
    localStorage.setItem('facteur_helper_labels', JSON.stringify(updatedLabels));
    setActiveLabelId(newLabel.id);
    setShowLabelManager(false);
  };

  const deleteLabel = (id: string) => {
    setConfirmAction({
      message: 'Supprimer ce label et tout son historique ?',
      onConfirm: () => {
        const updatedLabels = labels.filter(l => l.id !== id);
        const updatedHistory = history.filter(h => h.labelId !== id);
        setLabels(updatedLabels);
        setHistory(updatedHistory);
        localStorage.setItem('facteur_helper_labels', JSON.stringify(updatedLabels));
        localStorage.setItem('facteur_helper_history', JSON.stringify(updatedHistory));
        if (activeLabelId === id) {
          setActiveLabelId(null);
          setShowLabelManager(true);
        }
        setConfirmAction(null);
      }
    });
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('facteur_helper_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    setConfirmAction({
      message: 'Voulez-vous vraiment effacer tout l\'historique des extractions ?',
      onConfirm: () => {
        setHistory([]);
        localStorage.removeItem('facteur_helper_history');
        setConfirmAction(null);
      }
    });
  };

  const clearAllData = () => {
    setConfirmAction({
      message: 'Voulez-vous vraiment supprimer TOUS les labels et TOUT l\'historique ? Cette action est irréversible.',
      onConfirm: () => {
        setLabels([]);
        setHistory([]);
        setActiveLabelId(null);
        localStorage.removeItem('facteur_helper_labels');
        localStorage.removeItem('facteur_helper_history');
        setShowLabelManager(true);
        setConfirmAction(null);
      }
    });
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    
    const headers = ['Label', 'Nom Complet', 'Appartement', 'Adresse'];
    const rows = history.map(item => {
      const label = labels.find(l => l.id === item.labelId);
      return [
        label?.name || 'Sans label',
        item.nomComplet,
        item.appartement,
        item.adresse
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `extractions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = () => {
    if (history.length === 0) return;

    const data = history.map(item => {
      const label = labels.find(l => l.id === item.labelId);
      return {
        'Label': label?.name || 'Sans label',
        'Nom Complet': item.nomComplet,
        'Appartement': item.appartement,
        'Adresse': item.adresse
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Extractions");
    XLSX.writeFile(workbook, `extractions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleAuth = (password: string) => {
    if (password === settings.password) {
      setIsAuthenticated(true);
      setStatus({ type: null, message: '' });
    } else {
      setStatus({ type: 'error', message: 'Mot de passe incorrect' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const constraints = { 
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setStatus({ type: null, message: '' });
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setStatus({ type: 'error', message: "Impossible d'accéder à la caméra. Vérifiez les permissions." });
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setStatus({ type: 'error', message: "Attendez que la caméra soit prête..." });
        return;
      }

      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(dataUrl);
        stopCamera();
        setStatus({ type: null, message: '' });
      }
    }
  };

  const extractJSON = (text: string) => {
    try {
      // Try direct parse first
      return JSON.parse(text.trim());
    } catch (e) {
      // Try to find JSON object in the text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e2) {
          throw new Error("Impossible de décoder le format JSON de la réponse.");
        }
      }
      throw new Error("La réponse de l'IA ne contient pas de données valides.");
    }
  };

  const handleProcess = async () => {
    if (!capturedImage) return;
    if (!settings.apiKey) {
      setStatus({ type: 'error', message: "Veuillez configurer votre clé API OpenRouter" });
      setShowSettings(true);
      return;
    }

    setIsProcessing(true);
    setStatus({ type: null, message: '' });

    try {
      let content = '';

      // Direct IA Mode (Pixtral)
      const base64Image = capturedImage.split(',')[1];
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "Facteur Helper",
        },
        body: JSON.stringify({
          "model": "mistralai/pixtral-large-2411",
          "messages": [
            {
              "role": "system",
              "content": "Tu es un expert en lecture d'étiquettes de boîtes aux lettres.\n\nDirectives impératives :\n1. 'nomComplet' est la donnée MAÎTRESSE et OBLIGATOIRE. Extrais-le sans civilités (pas de 'M.', 'Mme', etc.).\n2. 'adresse' et 'appartement' sont secondaires et optionnels. \n3. L'ADRESSE ne doit JAMAIS contenir de nom de personne ni de civilité. Si tu lis 'M. et Mme BARWELL 5 Place de la Mairie', l'adresse est '5 Place de la Mairie' et le nom est 'BARWELL'.\n4. Ne mets RIEN dans 'adresse' qui ressemble à une identité humaine.\n5. Format de sortie : JSON pur."
            },
            {
              "role": "user",
              "content": [
                {
                  "type": "text",
                  "text": "Analyse cette image et extrais : { \"nomComplet\": \"...\", \"appartement\": \"...\", \"adresse\": \"...\" }"
                },
                {
                  "type": "image_url",
                  "image_url": {
                    "url": `data:image/jpeg;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          "response_format": { "type": "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur API OpenRouter');
      }

      const data = await response.json();
      content = data.choices[0].message.content;

      console.log("Raw content from AI:", content);
      const extracted = extractJSON(content);
      setEditingResult({
        nomComplet: extracted.nomComplet || '',
        appartement: extracted.appartement || '',
        adresse: extracted.adresse || '',
        rawResponse: content
      });

      setStatus({ type: 'success', message: 'Informations extraites avec succès !' });
      setCapturedImage(null);
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Échec de l\'extraction' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdited = () => {
    if (editingResult) {
      const names = (editingResult.nomComplet || '').split('\n').filter(name => name.trim() !== '');
      
      if (names.length > 0) {
        const resultsToSave = names.map(name => ({
          nomComplet: name.trim(),
          appartement: editingResult.appartement || '',
          adresse: editingResult.adresse || '',
          rawResponse: editingResult.rawResponse
        }));

        saveToHistory(resultsToSave);
        
        setEditingResult(null);
        setStatus({ 
          type: 'success', 
          message: names.length > 1 
            ? `${names.length} résultats enregistrés dans l'historique` 
            : 'Résultat enregistré dans l\'historique' 
        });
      } else {
        setStatus({ type: 'error', message: 'Le nom complet est requis' });
      }
    }
  };

  const renderContent = () => {
    // Initial Setup View
    if (!isInitialized) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-zinc-100"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="text-emerald-600 w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900">Configuration Initiale</h1>
              <p className="text-zinc-500 text-center mt-2 text-sm">
                Configurez votre accès sécurisé pour commencer.
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              saveSettings({
                password: formData.get('password') as string,
                apiKey: formData.get('apiKey') as string,
              });
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Mot de Passe</label>
                <input 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="Créez un mot de passe"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Clé API OpenRouter</label>
                <input 
                  name="apiKey" 
                  type="password" 
                  required
                  placeholder="sk-or-v1-..."
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-200 mt-4"
              >
                Enregistrer et Continuer
              </button>
            </form>
          </motion.div>
        </div>
      );
    }

    // Login View
    if (!isAuthenticated) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 font-sans">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-zinc-100"
          >
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                <Lock className="text-zinc-600 w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900">Facteur Helper</h1>
              <p className="text-zinc-500 text-center mt-2 text-sm">Entrez votre mot de passe pour accéder à l'application.</p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAuth(formData.get('password') as string);
            }} className="space-y-4">
              <input 
                name="password" 
                type="password" 
                required 
                autoFocus
                placeholder="Mot de passe"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-zinc-500 focus:border-transparent outline-none transition-all"
              />
              {status.type === 'error' && (
                <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} />
                  <span>{status.message}</span>
                </div>
              )}
              <button 
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-zinc-200"
              >
                Déverrouiller
              </button>
            </form>
          </motion.div>
        </div>
      );
    }

    // Settings View
    if (showSettings) {
      return (
        <div className="min-h-screen bg-zinc-50 p-4 font-sans">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-zinc-900">Paramètres</h1>
              <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-zinc-900">
                <X size={24} />
              </button>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-3xl shadow-md border border-zinc-100"
            >
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                saveSettings({
                  password: formData.get('password') as string || settings.password,
                  apiKey: formData.get('apiKey') as string || settings.apiKey,
                });
              }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Nouveau Mot de Passe</label>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="Laisser vide pour ne pas changer"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Clé API OpenRouter</label>
                  <input 
                    name="apiKey" 
                    type="password" 
                    placeholder="Laisser vide pour ne pas changer"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
                >
                  Enregistrer les modifications
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      );
    }

    // History View
    if (showHistory) {
      return (
        <div className="min-h-screen bg-zinc-50 p-4 font-sans pb-24">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-zinc-900">Historique</h1>
              <button onClick={() => setShowHistory(false)} className="text-zinc-500 hover:text-zinc-900">
                <X size={24} />
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              <button 
                onClick={exportToCSV}
                disabled={history.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <Download size={18} />
                CSV
              </button>
              <button 
                onClick={exportToExcel}
                disabled={history.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-zinc-200 py-3 rounded-xl font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                <FileSpreadsheet size={18} />
                Excel
              </button>
              <button 
                onClick={clearHistory}
                disabled={history.length === 0}
                className="flex items-center justify-center p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="space-y-8">
              {labels.map(label => {
                const labelHistory = history.filter(h => h.labelId === label.id);
                if (labelHistory.length === 0) return null;

                return (
                  <div key={label.id} className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                      <Tag size={16} className="text-emerald-600" />
                      <h2 className="font-bold text-zinc-900">{label.name}</h2>
                      <span className="text-xs text-zinc-400 font-medium bg-zinc-100 px-2 py-0.5 rounded-full">
                        {labelHistory.length}
                      </span>
                    </div>
                    <div className="space-y-4">
                      {labelHistory.map((item) => (
                        <motion.div 
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm relative group"
                        >
                          <button 
                            onClick={() => deleteFromHistory(item.id)}
                            className="absolute top-2 right-2 p-2 text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <div className="text-[10px] uppercase font-bold text-zinc-400">Nom Complet</div>
                              <div className="font-medium text-zinc-900">{item.nomComplet || '-'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-zinc-400">Appartement</div>
                              <div className="font-medium text-zinc-900">{item.appartement || '-'}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-[10px] uppercase font-bold text-zinc-400">Adresse</div>
                              <div className="font-medium text-zinc-900 text-xs">{item.adresse || '-'}</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && (
                <div className="text-center py-12 text-zinc-400">
                  <History size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Aucune extraction enregistrée</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Label Manager View
    if (showLabelManager) {
      return (
        <div className="min-h-screen bg-zinc-50 p-4 font-sans">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-bold text-zinc-900">Choisir un Label</h1>
              <div className="flex gap-2">
                <button onClick={() => setShowHistory(true)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <History size={20} />
                </button>
                <button onClick={() => setShowSettings(true)} className="p-2 text-zinc-400 hover:text-zinc-900">
                  <Settings size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {/* New Label Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const name = formData.get('labelName') as string;
                if (name) {
                  addLabel(name);
                  e.currentTarget.reset();
                }
              }} className="bg-white p-4 rounded-3xl shadow-sm border border-zinc-100 flex gap-2">
                <input 
                  name="labelName"
                  placeholder="Nouveau label (ex: Rue de Paris)"
                  className="flex-1 px-4 py-2 rounded-xl border border-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button type="submit" className="bg-emerald-600 text-white p-2 rounded-xl">
                  <Plus size={24} />
                </button>
              </form>

              {/* Labels List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Labels Récents</h2>
                  {labels.length > 0 && (
                    <button 
                      onClick={clearAllData}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-tight flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Tout supprimer
                    </button>
                  )}
                </div>
                {labels.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-zinc-200 text-zinc-400">
                    <Tag size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Créez votre premier label pour commencer</p>
                  </div>
                ) : (
                  labels.map(label => (
                    <div key={label.id} className="flex gap-2">
                      <button 
                        onClick={() => {
                          setActiveLabelId(label.id);
                          setShowLabelManager(false);
                        }}
                        className="flex-1 flex items-center justify-between p-4 bg-white rounded-2xl border border-zinc-100 hover:border-emerald-200 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                            <Tag size={20} />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-zinc-900">{label.name}</div>
                            <div className="text-[10px] text-zinc-400">
                              {history.filter(h => h.labelId === label.id).length} extractions
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-zinc-300 group-hover:text-emerald-600 transition-colors" />
                      </button>
                      <button 
                        onClick={() => deleteLabel(label.id)}
                        className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Main App View
    return (
      <div className="min-h-screen bg-zinc-50 font-sans pb-24">
        {/* Header */}
        <header className="bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowLabelManager(true)}
              className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100"
            >
              <Tag className="text-white w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-zinc-900 tracking-tight leading-none">Facteur Helper</h1>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-1">
                {labels.find(l => l.id === activeLabelId)?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHistory(true)}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-all"
            >
              <History size={20} />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-all"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="max-w-md mx-auto p-6 space-y-6">
          {/* Status Messages */}
          <AnimatePresence>
            {status.type && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-2xl flex items-center gap-3 ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-medium">{status.message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Preview / Capture */}
          <div className="relative aspect-[3/4] bg-zinc-200 rounded-[32px] overflow-hidden shadow-inner border-4 border-white">
            {isCameraActive ? (
              <div className="relative w-full h-full">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                  <button 
                    onClick={capturePhoto}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-zinc-200 active:scale-95 transition-transform"
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-zinc-900" />
                  </button>
                  <button 
                    onClick={stopCamera}
                    className="absolute right-6 bottom-4 text-white bg-black/50 px-4 py-2 rounded-full text-xs font-bold backdrop-blur-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setCapturedImage(null)}
                  className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/70 transition-all"
                >
                  <LogOut className="rotate-180" size={18} />
                </button>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 gap-4">
                <div className="w-20 h-20 bg-zinc-100 rounded-full flex items-center justify-center">
                  <ImageIcon size={40} />
                </div>
                <p className="text-sm font-medium">Aucune image sélectionnée</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={startCamera}
              disabled={isCameraActive}
              className="flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Camera size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Caméra</span>
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all active:scale-95"
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <ImageIcon size={24} />
              </div>
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">Galerie</span>
            </button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {/* Hidden Canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />
        </main>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-zinc-50 via-zinc-50 to-transparent">
          <button 
            onClick={handleProcess}
            disabled={!capturedImage || isProcessing}
            className={`w-full max-w-md mx-auto flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl ${
              capturedImage && !isProcessing
                ? 'bg-zinc-900 text-white shadow-zinc-200 hover:bg-zinc-800'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span className="text-sm">Analyse IA en cours...</span>
              </div>
            ) : (
              <>
                <Key size={20} />
                <span>Extraire Infos (Mistral)</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {renderContent()}
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl border border-zinc-100"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">Confirmation</h3>
                  <p className="text-sm text-zinc-500 mt-1">{confirmAction.message}</p>
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <button 
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-3 rounded-xl border border-zinc-100 font-bold text-zinc-400 hover:bg-zinc-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={confirmAction.onConfirm}
                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Result Editing Popup */}
      <AnimatePresence>
        {editingResult && (
          <ResultPopup 
            result={editingResult}
            onSave={handleSaveEdited}
            onClose={() => setEditingResult(null)}
            onChange={(field, value) => setEditingResult(prev => prev ? { ...prev, [field]: value } : null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const ResultPopup = ({ 
  result, 
  onSave, 
  onClose, 
  onChange 
}: { 
  result: Partial<ExtractionResult>, 
  onSave: () => void, 
  onClose: () => void,
  onChange: (field: keyof ExtractionResult, value: string) => void
}) => {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="bg-white rounded-[32px] w-full max-w-md shadow-2xl border border-zinc-100 overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
            <h3 className="font-bold text-zinc-900">Résultat de l'Analyse</h3>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 ml-1">Nom Complet (un par ligne pour dupliquer)</label>
            <textarea 
              value={result.nomComplet || ''}
              onChange={(e) => onChange('nomComplet', e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-zinc-900 min-h-[100px] resize-none"
              placeholder="Nom de la personne (un par ligne)"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 ml-1">Appartement</label>
              <input 
                value={result.appartement || ''}
                onChange={(e) => onChange('appartement', e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-zinc-900"
                placeholder="N° Appt"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 ml-1">Code Postal / Ville</label>
              <div className="w-full px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-zinc-400 text-xs flex items-center">
                Auto-détecté
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1 ml-1">Adresse</label>
            <textarea 
              value={result.adresse || ''}
              onChange={(e) => onChange('adresse', e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-zinc-900 min-h-[80px] resize-none"
              placeholder="Adresse complète"
            />
          </div>
        </div>

        <div className="p-6 bg-zinc-50/50 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border border-zinc-200 font-bold text-zinc-500 hover:bg-white transition-all active:scale-95"
          >
            Fermer
          </button>
          <button 
            onClick={onSave}
            className="flex-1 py-4 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 active:scale-95"
          >
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
};
