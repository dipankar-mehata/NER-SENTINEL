import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const LABELS = {
  en: {
    title: 'Field Incident Reporter',
    subtitle: 'NER-SENTINEL Field App',
    gpsSection: 'GPS Location',
    incidentType: 'Incident Type',
    severity: 'Severity',
    description: 'Description',
    descPlaceholder: 'Describe what you observed...',
    photo: 'Photo Evidence',
    voice: 'Voice Note',
    recording: 'Recording...',
    recordNote: 'Tap to record',
    submit: 'Submit Report',
    submitting: 'Submitting...',
    offline: '📴 Offline Mode — Reports saved locally',
    pendingSync: 'reports pending sync',
    online: 'Online',
    severity_low: 'LOW',
    severity_medium: 'MEDIUM',
    severity_high: 'HIGH',
    types: ['Landslide', 'Flood', 'Road Damage', 'Bridge Damage', 'Traffic Block', 'Vehicle Breakdown'],
    success: '✅ Report submitted successfully!',
    savedLocally: '📁 Report saved locally (offline)',
    error: '❌ Failed to submit report.',
  },
  hi: {
    title: 'फील्ड घटना रिपोर्टर',
    subtitle: 'NER-SENTINEL फील्ड ऐप',
    gpsSection: 'GPS स्थान',
    incidentType: 'घटना का प्रकार',
    severity: 'गंभीरता',
    description: 'विवरण',
    descPlaceholder: 'आपने क्या देखा...',
    photo: 'फोटो साक्ष्य',
    voice: 'वॉइस नोट',
    recording: 'रिकॉर्डिंग हो रही है...',
    recordNote: 'रिकॉर्ड करें',
    submit: 'रिपोर्ट जमा करें',
    submitting: 'जमा हो रहा है...',
    offline: '📴 ऑफलाइन मोड — रिपोर्ट स्थानीय रूप से सहेजी गई',
    pendingSync: 'रिपोर्ट सिंक के लिए लंबित',
    online: 'ऑनलाइन',
    severity_low: 'कम',
    severity_medium: 'मध्यम',
    severity_high: 'उच्च',
    types: ['भूस्खलन', 'बाढ़', 'सड़क क्षति', 'पुल क्षति', 'यातायात अवरोध', 'वाहन खराबी'],
    success: '✅ रिपोर्ट सफलतापूर्वक जमा!',
    savedLocally: '📁 रिपोर्ट स्थानीय रूप से सहेजी (ऑफलाइन)',
    error: '❌ रिपोर्ट जमा करने में विफल।',
  },
};

type Lang = 'en' | 'hi';

interface PendingIncident {
  id: string;
  incident_type: string;
  severity: string;
  lat: number;
  lng: number;
  description: string;
  source: string;
  confidence_pct: number;
  timestamp: string;
}

export default function FieldPage() {
  const [lang, setLang] = useState<Lang>('en');
  const L = LABELS[lang];

  const [isOnline, setIsOnline] = useState(true);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [incidentType, setIncidentType] = useState(0);
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [pendingQueue, setPendingQueue] = useState<PendingIncident[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'saved'; msg: string } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncQueue();
    };
    const handleOffline = () => setIsOnline(false);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load pending queue from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pendingIncidents');
      if (stored) setPendingQueue(JSON.parse(stored));
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Get GPS
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not available'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true }
    );
  }, []);

  const syncQueue = async () => {
    const stored = localStorage.getItem('pendingIncidents');
    if (!stored) return;
    const queue: PendingIncident[] = JSON.parse(stored);
    if (queue.length === 0) return;

    const remaining: PendingIncident[] = [];
    for (const incident of queue) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(incident),
        });
        if (!res.ok) remaining.push(incident);
      } catch {
        remaining.push(incident);
      }
    }
    localStorage.setItem('pendingIncidents', JSON.stringify(remaining));
    setPendingQueue(remaining);
  };

  const saveToQueue = (incident: PendingIncident) => {
    const updated = [...pendingQueue, incident];
    setPendingQueue(updated);
    localStorage.setItem('pendingIncidents', JSON.stringify(updated));
  };

  const buildPayload = (): PendingIncident => ({
    id: `local-${Date.now()}`,
    incident_type: lang === 'en' ? L.types[incidentType] : LABELS.en.types[incidentType],
    severity,
    lat: gps?.lat ?? 26.1445,
    lng: gps?.lng ?? 91.7362,
    description: description + (voiceTranscript ? ` [Voice: ${voiceTranscript}]` : ''),
    source: 'FIELD_OFFICER',
    confidence_pct: 90,
    timestamp: new Date().toISOString(),
  });

  const handleSubmit = async () => {
    if (!description.trim()) {
      setFeedback({ type: 'error', msg: '❌ Please add a description.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    const payload = buildPayload();

    if (!isOnline) {
      saveToQueue(payload);
      setFeedback({ type: 'saved', msg: L.savedLocally });
      resetForm();
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFeedback({ type: 'success', msg: L.success });
      resetForm();
    } catch {
      // Save to queue on network failure
      saveToQueue(payload);
      setFeedback({ type: 'saved', msg: L.savedLocally });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setVoiceTranscript('');
    setPhotoFile(null);
    setSeverity('MEDIUM');
    setIncidentType(0);
  };

  const toggleRecording = () => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.onresult = (event: { results: { transcript: string }[][] }) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ');
      setVoiceTranscript(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const severityOptions: { key: 'LOW' | 'MEDIUM' | 'HIGH'; label: string; color: string }[] = [
    { key: 'LOW', label: L.severity_low, color: 'bg-green-700 border-green-500 text-white' },
    { key: 'MEDIUM', label: L.severity_medium, color: 'bg-yellow-700 border-yellow-500 text-white' },
    { key: 'HIGH', label: L.severity_high, color: 'bg-red-700 border-red-500 text-white' },
  ];

  return (
    <>
      <Head>
        <title>Field Reporter — NER-SENTINEL</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#111827" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-white pb-8">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 text-sm">← Home</Link>
              <div className="w-px h-4 bg-gray-700" />
              <div>
                <div className="text-white font-bold text-sm">{L.title}</div>
                <div className="text-gray-500 text-xs">{L.subtitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Online/Offline Indicator */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
                <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                  {isOnline ? L.online : 'Offline'}
                </span>
              </div>
              {/* Language Toggle */}
              <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <button
                  onClick={() => setLang('en')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang('hi')}
                  className={`px-3 py-1.5 text-xs font-bold transition-all ${lang === 'hi' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
                >
                  हिं
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-red-900 border-b border-red-700 px-4 py-2 text-center text-red-200 text-sm">
            {L.offline}
          </div>
        )}

        {/* Pending Queue Banner */}
        {pendingQueue.length > 0 && (
          <div className="bg-yellow-900/60 border-b border-yellow-700 px-4 py-2 flex items-center justify-between">
            <span className="text-yellow-300 text-sm">
              📤 {pendingQueue.length} {L.pendingSync}
            </span>
            {isOnline && (
              <button
                onClick={syncQueue}
                className="text-yellow-400 text-xs underline"
              >
                Sync now
              </button>
            )}
          </div>
        )}

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          {/* Feedback */}
          {feedback && (
            <div className={`p-3 rounded-xl border text-sm ${
              feedback.type === 'success' ? 'bg-green-900/40 border-green-700 text-green-300' :
              feedback.type === 'saved' ? 'bg-blue-900/40 border-blue-700 text-blue-300' :
              'bg-red-900/40 border-red-700 text-red-300'
            }`}>
              {feedback.msg}
            </div>
          )}

          {/* GPS Card */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
              📡 {L.gpsSection}
            </div>
            {gps ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-300 text-sm font-mono">
                  {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                </span>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                {gpsError || '🔄 Acquiring GPS signal...'}
              </div>
            )}
          </div>

          {/* Incident Type */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">{L.incidentType}</div>
            <div className="grid grid-cols-2 gap-2">
              {L.types.map((type, i) => (
                <button
                  key={i}
                  onClick={() => setIncidentType(i)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all text-left ${
                    incidentType === i
                      ? 'bg-blue-700 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750 hover:border-gray-600'
                  }`}
                >
                  {['🏔️', '🌊', '🛣️', '🌉', '🚦', '🚗'][i]} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">{L.severity}</div>
            <div className="grid grid-cols-3 gap-3">
              {severityOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSeverity(opt.key)}
                  className={`py-4 rounded-xl font-bold text-sm border-2 transition-all ${
                    severity === opt.key
                      ? opt.color + ' scale-105 shadow-lg'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:bg-gray-750'
                  }`}
                >
                  {opt.key === 'LOW' ? '🟢' : opt.key === 'MEDIUM' ? '🟡' : '🔴'}
                  <br />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">{L.description}</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={L.descPlaceholder}
              rows={4}
              className="w-full bg-gray-800 border border-gray-600 text-white placeholder-gray-600 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Photo Upload */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">📷 {L.photo}</div>
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                photoFile ? 'border-green-600 bg-green-900/20' : 'border-gray-600 hover:border-gray-500'
              }`}>
                {photoFile ? (
                  <div>
                    <div className="text-green-400 text-2xl mb-1">✅</div>
                    <div className="text-green-300 text-sm font-medium">{photoFile.name}</div>
                    <div className="text-gray-500 text-xs mt-0.5">
                      {(photoFile.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-gray-500 text-3xl mb-1">📷</div>
                    <div className="text-gray-400 text-sm">Tap to take photo or upload</div>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Voice Note */}
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-gray-400 text-xs uppercase tracking-wider mb-3">🎙️ {L.voice}</div>
            <button
              onClick={toggleRecording}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-all border-2 ${
                isRecording
                  ? 'bg-red-700 border-red-500 text-white animate-pulse'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-750 hover:border-gray-500'
              }`}
            >
              {isRecording ? `🔴 ${L.recording}` : `🎙️ ${L.recordNote}`}
            </button>
            {voiceTranscript && (
              <div className="mt-3 bg-gray-800 border border-gray-600 rounded-xl p-3">
                <div className="text-gray-500 text-xs mb-1">Transcript:</div>
                <p className="text-gray-200 text-sm italic">{voiceTranscript}</p>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-xl text-lg transition-all shadow-xl flex items-center justify-center gap-3"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {L.submitting}
              </>
            ) : (
              <>📤 {L.submit}</>
            )}
          </button>

          {/* Pending Queue Details */}
          {pendingQueue.length > 0 && (
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">📋 Pending Queue</div>
              <div className="space-y-2">
                {pendingQueue.map((item) => (
                  <div key={item.id} className="bg-gray-800 rounded-lg p-2.5 text-xs flex justify-between items-center">
                    <div>
                      <span className="text-white font-medium">{item.incident_type}</span>
                      <span className="text-gray-500 ml-2">{item.severity}</span>
                    </div>
                    <span className="text-gray-600">{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
