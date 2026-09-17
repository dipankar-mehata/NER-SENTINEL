'use client';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const SUGGESTED_QUERIES = [
  'Which critical deliveries are at risk?',
  'What if Route A closes?',
  'Show weather impact on routes',
  'Are there supply shortages?',
  'What are the bottlenecks?',
  'Which roads are most dangerous?',
];

function renderMarkdown(text: string) {
  // Convert **bold** to <strong>
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendQuery = async (query: string) => {
    if (!query.trim() || loading) return;

    const userMessage: Message = { role: 'user', text: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: data.response || 'No response received.', timestamp: new Date() },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          text: '❌ **Error connecting to AI.** Please check if the backend is running at http://localhost:8000.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-700 overflow-hidden" style={{ minHeight: '70vh' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-4 border-b border-blue-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h2 className="text-white font-bold text-lg">Logistics AI Copilot</h2>
            <p className="text-blue-300 text-xs">Querying live database • NER-SENTINEL Intelligence</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs">Online</span>
          </div>
        </div>
      </div>

      {/* Suggested Queries */}
      {messages.length === 0 && (
        <div className="px-4 pt-4 pb-2 flex-shrink-0">
          <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider">Suggested queries</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => sendQuery(q)}
                className="bg-gray-800 hover:bg-blue-800 text-gray-300 hover:text-white text-xs px-3 py-2 rounded-full border border-gray-600 hover:border-blue-500 transition-all duration-200"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🛰️</div>
            <p className="text-gray-400 text-lg font-semibold">NER-SENTINEL AI Ready</p>
            <p className="text-gray-600 text-sm mt-2 max-w-sm">
              Ask me about critical deliveries, road risks, weather impacts, supply shortages, or route alternatives.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-1">
                  🤖
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-tl-sm'
                }`}
              >
                <div>{renderMarkdown(msg.text)}</div>
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0 ml-2 mt-1">
                  👤
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-sm flex-shrink-0 mr-2 mt-1">
              🤖
            </div>
            <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-gray-400 text-xs">Analyzing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested chips when messages exist */}
      {messages.length > 0 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 border-t border-gray-800">
          {SUGGESTED_QUERIES.slice(0, 3).map((q) => (
            <button
              key={q}
              onClick={() => sendQuery(q)}
              className="bg-gray-800 hover:bg-blue-800 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-full border border-gray-700 hover:border-blue-600 transition-all whitespace-nowrap flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-700 flex gap-3 flex-shrink-0 bg-gray-900">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); } }}
          placeholder="Ask about routes, risks, supply status..."
          className="flex-1 bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          disabled={loading}
        />
        <button
          onClick={() => sendQuery(input)}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2"
        >
          <span>Send</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
