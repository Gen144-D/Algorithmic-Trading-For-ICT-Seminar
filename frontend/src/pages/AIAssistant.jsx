import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

const SUGGESTIONS = [
  'How does stop-loss and take-profit work?',
  'Why is backtesting important?',
  'What happens when I activate a strategy?',
  'How do SMA and RSI indicators work?',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I\'m your trading assistant. Ask about strategies, backtesting, indicators, or risk management.' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setBusy(true);
    try {
      const res = await api('/ai/chat', { method: 'POST', body: { message: msg } });
      setMessages((m) => [...m, { role: 'assistant', text: res.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: `AI service unavailable: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Assistant</h1>
        <p className="text-sm text-slate-400 mt-1">Analytical support for market conditions and strategy performance. Rules you define drive execution — AI assists, it does not override.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)} className="btn-ghost text-xs">{s}</button>
        ))}
      </div>

      <div className="card flex flex-col h-[28rem]">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${m.role === 'user' ? 'bg-accent text-base-950' : 'bg-base-900 text-slate-200'}`}>
                {m.text}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-slate-500">thinking…</div>}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 mt-4">
          <input
            className="input"
            placeholder="Ask about the system, strategies, indicators…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button onClick={() => send()} className="btn-primary" disabled={busy}>Send</button>
        </div>
      </div>
    </div>
  );
}
