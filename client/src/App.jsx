import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles, Plus, MessageSquare, Trash2, Sun, Moon, Menu, X,
  Send, User, Bot, Copy, Check, ChevronDown, ChevronUp, FileText, Eraser,
} from "lucide-react";

/* ─── helpers ──────────────────────────────────────────── */
const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const time = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const SUGGESTIONS = [
  { title: "What is Fresh Basket?", desc: "Learn about the grocery store" },
  { title: "List all products", desc: "See what's available in the PDF" },
  { title: "Delivery policy", desc: "How does delivery work?" },
  { title: "Store timings", desc: "Operating hours from the PDF" },
];

/* ─── tiny toast ───────────────────────────────────────── */
function Toast({ toast, onDone }) {
  useEffect(() => { if (toast) { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); } }, [toast, onDone]);
  if (!toast) return null;
  return <div className={`toast ${toast.type}`}>{toast.msg}</div>;
}

/* ─── single message ───────────────────────────────────── */
function Msg({ m }) {
  const [copied, setCopied] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const isUser = m.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(m.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`msg ${isUser ? "user" : "assistant"}`}>
      <div className={`avatar ${isUser ? "u" : "a"}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className="bubble-wrap">
        <div className="bubble">
          {isUser ? m.content : (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          )}
          {!isUser && m.sources?.length > 0 && (
            <>
              <button className="src-toggle" onClick={() => setShowSrc(v => !v)} aria-expanded={showSrc}>
                <FileText size={12} />
                {showSrc ? "Hide" : "Show"} sources ({m.sources.length})
                {showSrc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showSrc && (
                <div className="src-box">
                  {m.sources.map((s, i) => <div key={i} className="src-item"><strong>#{i + 1}</strong> {s}</div>)}
                </div>
              )}
            </>
          )}
        </div>
        <div className="msg-meta">
          <span>{m.ts}</span>
          {!isUser && (
            <button className="copy-btn" onClick={copy}>
              {copied ? <Check size={12} style={{ color: "var(--green)" }} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── App ──────────────────────────────────────────────── */
export default function App() {
  const stored = () => { try { return JSON.parse(localStorage.getItem("rag_sessions")) || []; } catch { return []; } };
  const [sessions, setSessions] = useState(stored);
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("rag_theme") || "dark");
  const [sideOpen, setSideOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const active = sessions.find(s => s.id === activeId) ?? null;
  const messages = active?.messages ?? [];

  /* persist */
  useEffect(() => { localStorage.setItem("rag_sessions", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("rag_theme", theme); }, [theme]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  /* session helpers */
  const newChat = useCallback(() => {
    const s = { id: uid(), title: "New Chat", messages: [], createdAt: Date.now() };
    setSessions(prev => [s, ...prev]);
    setActiveId(s.id);
    setSideOpen(false);
  }, []);

  const selectSession = useCallback((id) => { setActiveId(id); setSideOpen(false); }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? null);
      return next;
    });
  }, [activeId]);

  const clearAll = useCallback(() => { setSessions([]); setActiveId(null); }, []);

  /* send message */
  const send = useCallback(async (text) => {
    if (!text.trim() || loading) return;

    let sid = activeId;
    if (!sid) {
      const s = { id: uid(), title: text.slice(0, 40), messages: [], createdAt: Date.now() };
      setSessions(prev => [s, ...prev]);
      sid = s.id;
      setActiveId(sid);
    }

    const userMsg = { id: uid(), role: "user", content: text.trim(), ts: time() };

    setSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const title = s.messages.length === 0 ? text.trim().slice(0, 40) : s.title;
      return { ...s, title, messages: [...s.messages, userMsg] };
    }));

    setLoading(true);

    try {
      const res = await fetch("/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      const aiMsg = { id: uid(), role: "assistant", content: data.ai, sources: data.sources ?? [], ts: time() };

      setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: [...s.messages, aiMsg] } : s));
    } catch (err) {
      const errMsg = { id: uid(), role: "assistant", content: `⚠️ **Error:** ${err.message}`, ts: time() };
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, messages: [...s.messages, errMsg] } : s));
      setToast({ type: "err", msg: err.message });
    } finally {
      setLoading(false);
    }
  }, [activeId, loading]);

  /* textarea submit (IME-safe) */
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.isComposing || e.keyCode === 229) return;
      send(e.target.value);
      e.target.value = "";
      e.target.style.height = "auto";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const ta = inputRef.current;
    if (!ta) return;
    send(ta.value);
    ta.value = "";
    ta.style.height = "auto";
  };

  const autoGrow = (e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <div className="logo"><Sparkles size={18} /></div>
          <div>
            <h1>RAG Chat</h1>
            <small>PDF Knowledge</small>
          </div>
          {sideOpen && <button className="hamburger" onClick={() => setSideOpen(false)} aria-label="Close sidebar" style={{ marginLeft: "auto" }}><X size={18} /></button>}
        </div>

        <button className="new-btn" onClick={newChat}><Plus size={16} /> New Chat</button>

        <div className="chat-list">
          <div className="section-label">History</div>
          {sessions.length === 0 && <div style={{ padding: "14px 6px", color: "var(--text-3)", fontSize: "12px", textAlign: "center" }}>No chats yet</div>}
          {sessions.map(s => (
            <div key={s.id} className={`chat-item ${s.id === activeId ? "active" : ""}`} onClick={() => selectSession(s.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") selectSession(s.id); }}>
              <div className="chat-item-left"><MessageSquare size={14} /><span>{s.title}</span></div>
              <button className="del-btn" aria-label="Delete chat" onClick={e => { e.stopPropagation(); deleteSession(s.id); }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>

        <div className="sidebar-foot">
          <button className="side-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </button>
          {sessions.length > 0 && (
            <button className="side-btn" style={{ color: "var(--text-3)" }} onClick={clearAll}>
              <Eraser size={15} /> Clear All
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="hamburger" onClick={() => setSideOpen(true)} aria-label="Open sidebar"><Menu size={20} /></button>
            <span style={{ fontWeight: 600, fontSize: "15px" }}>{active?.title ?? "RAG Chat"}</span>
          </div>
          <div className="topbar-right">
            <div className="pill green"><span className="dot pulse" /> API Connected</div>
          </div>
        </header>

        {/* Messages */}
        <div className="messages">
          {messages.length === 0 && !loading ? (
            <div className="empty">
              <div className="empty-icon"><Sparkles size={28} /></div>
              <h2>Ask your PDF anything</h2>
              <p>This RAG assistant answers questions strictly from the uploaded <strong>knowledge.pdf</strong>. Ask anything about its contents!</p>
              <div className="cards">
                {SUGGESTIONS.map((s, i) => (
                  <div key={i} className="card" onClick={() => { send(s.title); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") send(s.title); }}>
                    <div className="card-title">{s.title}</div>
                    <div className="card-desc">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(m => <Msg key={m.id} m={m} />)}
              {loading && (
                <div className="msg assistant">
                  <div className="avatar a"><Bot size={16} /></div>
                  <div className="bubble-wrap">
                    <div className="typing"><span className="t-dot" /><span className="t-dot" /><span className="t-dot" /></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="input-area">
          <form className="input-box" onSubmit={handleSubmit}>
            <label htmlFor="chat-input" className="sr-only">Message</label>
            <textarea
              ref={inputRef}
              id="chat-input"
              className="chat-input"
              placeholder="Ask something about your PDF…"
              rows={1}
              onKeyDown={handleKey}
              onInput={autoGrow}
              disabled={loading}
            />
            <button type="submit" className="send" disabled={loading} aria-label="Send message">
              <Send size={18} />
            </button>
          </form>
          <div className="hint">Press Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
