/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Image as ImageIcon, Settings, Lock, Send, CheckCircle2, AlertCircle, LogOut, Key, History, Download, Trash2, X, Cpu, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Tesseract from 'tesseract.js';

// Types
interface AppSettings {
  apiKey: string;
  password: string;
}

interface ExtractionResult {
  id: string;
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
  const [processingMode, setProcessingMode] = useState<'direct' | 'tesseract'>('direct');
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '',
    password: '',
  });
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
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    localStorage.setItem('facteur_helper_settings', JSON.stringify(newSettings));
    setSettings(newSettings);
    setIsInitialized(true);
    setIsAuthenticated(true);
    setShowSettings(false);
  };

  const saveToHistory = (result: Omit<ExtractionResult, 'id' | 'timestamp'>) => {
    const newEntry: ExtractionResult = {
      ...result,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('facteur_helper_history', JSON.stringify(updatedHistory));
  };

  const deleteFromHistory = (id: string) => {
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('facteur_helper_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    if (window.confirm('Voulez-vous vraiment effacer tout l\'historique ?')) {
      setHistory([]);
      localStorage.removeItem('facteur_helper_history');
    }
  };

  const exportToCSV = () => {
    if (history.length === 0) return;
    
    const headers = ['Date', 'Nom Complet', 'Appartement', 'Adresse'];
    const rows = history.map(item => [
      new Date(item.timestamp).toLocaleString(),
      item.nomComplet,
      item.appartement,
      item.adresse
    ]);

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

  const binarizeImage = (imageData: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageData);
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // Simple thresholding for binarization
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const threshold = 128;
          const value = gray > threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.src = imageData;
    });
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
      let extractedText = '';
      let content = '';

      if (processingMode === 'tesseract') {
        // 1. Binarize image
        const binarized = await binarizeImage(capturedImage);
        
        // 2. Tesseract OCR
        const { data: { text } } = await Tesseract.recognize(binarized, 'fra+eng');
        extractedText = text;
        console.log(extractedText)

        if (!extractedText.trim()) {
          throw new Error("Tesseract n'a pu extraire aucun texte de l'image.");
        }

        // 3. Send text to OpenRouter
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${settings.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "Facteur Helper",
          },
          body: JSON.stringify({
            "model": "mistralai/mistral-7b-instruct-v0.1",
            "messages": [
              {
                "role": "system",
                "content": "Tu es un assistant spécialisé dans la logistique postale française. Ton rôle est d'extraire avec précision les noms des résidents et les adresses à partir de textes bruts issus d'OCR de boîtes aux lettres.\n\nRègles CRITIQUES :\n1. 'nomComplet' est OBLIGATOIRE. 'adresse' et 'appartement' sont OPTIONNELS.\n2. INTERDICTION ABSOLUE d'inclure 'M.', 'Mme', 'Mr', 'Monsieur', 'Madame', 'Famille' ou tout NOM DE PERSONNE dans le champ 'adresse'.\n3. Le champ 'adresse' doit contenir EXCLUSIVEMENT la rue, le code postal et la ville. Si tu vois 'M. et Mme Martin 12 rue des Fleurs', alors nomComplet='Martin' et adresse='12 rue des Fleurs'.\n4. Supprime les civilités du champ 'nomComplet' également.\n5. Si l'adresse ou l'appartement ne sont pas identifiables, laisse-les vides (\"\").\n6. Réponds UNIQUEMENT en JSON."
              },
              {
                "role": "user",
                "content": `Texte OCR à analyser : "${extractedText}"\n\nExtrais les infos au format JSON : { "nomComplet": "...", "appartement": "...", "adresse": "..." }`
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
      } else {
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
      }

      console.log("Raw content from AI:", content);
      const extracted = extractJSON(content);
      saveToHistory({
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
              Exporter CSV
            </button>
            <button 
              onClick={clearHistory}
              disabled={history.length === 0}
              className="flex items-center justify-center p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <History size={48} className="mx-auto mb-4 opacity-20" />
                <p>Aucune extraction enregistrée</p>
              </div>
            ) : (
              history.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm relative group"
                >
                  <button 
                    onClick={() => deleteFromHistory(item.id)}
                    className="absolute top-2 right-2 p-2 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="text-[10px] text-zinc-400 font-mono mb-2">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
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
              ))
            )}
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
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-100">
            <Camera className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-zinc-900 tracking-tight">Facteur Helper</h1>
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
        {/* Mode Selection */}
        <div className="flex bg-white p-1 rounded-2xl border border-zinc-100 shadow-sm">
          <button 
            onClick={() => setProcessingMode('direct')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              processingMode === 'direct' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Cpu size={18} />
            Direct IA
          </button>
          <button 
            onClick={() => setProcessingMode('tesseract')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
              processingMode === 'tesseract' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <ScanLine size={18} />
            Tesseract + IA
          </button>
        </div>

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
              <span className="text-sm">
                {processingMode === 'tesseract' ? "OCR Tesseract en cours..." : "Analyse IA en cours..."}
              </span>
            </div>
          ) : (
            <>
              <Key size={20} />
              <span>Extraire Infos ({processingMode === 'tesseract' ? 'Tesseract' : 'Mistral'})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
