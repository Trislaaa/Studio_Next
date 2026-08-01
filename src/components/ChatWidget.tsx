'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, MessageCircle, Send, X, Bot, Sparkles } from 'lucide-react';

type Role = 'assistant' | 'user';

type Message = {
  id: string;
  role: Role;
  content: string;
};

const STORAGE_KEY = 'studionext_chat_session_token';

function createMessage(role: Role, content: string): Message {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export default function ChatWidget() {
  const pathname = usePathname();
  const hidden = useMemo(() => {
    return pathname.startsWith('/admin') || pathname.startsWith('/staff');
  }, [pathname]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    createMessage(
      'assistant',
      'Welcome to Studio Next Technology! I am your AI assistant. Ask me anything about our CAD/CAM software, automatic fabric spreading & CNC cutting machinery, job-work design studio, 110-hour technical training, headquarters address, or Experience Center.'
    ),
  ]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSessionToken(stored);
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBusy]);

  const quickActions = [
    'What CAD/CAM software do you offer?',
    'Tell me about Spreading & Cutting Machines',
    'What are your contact details & address?',
    'What services & training do you provide?',
    'How to visit the Experience Center?',
  ];

  async function ensureSession(forceNew = false) {
    if (!forceNew && sessionToken) {
      return sessionToken;
    }

    const response = await fetch('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    if (!response.ok || !data?.session?.sessionToken) {
      throw new Error(data?.error ?? 'Unable to initialize chat session');
    }

    const token = String(data.session.sessionToken);
    setSessionToken(token);
    window.localStorage.setItem(STORAGE_KEY, token);
    return token;
  }

  async function sendChatMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsBusy(true);
    setDraft('');
    setMessages((current) => [...current, createMessage('user', trimmed)]);

    try {
      let token = await ensureSession();
      let response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: token,
          message: trimmed,
        }),
      });

      if (response.status === 410) {
        token = await ensureSession(true);
        response = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: token,
            message: trimmed,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok || !data?.reply) {
        throw new Error(data?.error ?? 'Unable to process your message');
      }

      setMessages((current) => [...current, createMessage('assistant', String(data.reply))]);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Something went wrong while processing your request.';
      setMessages((current) => [...current, createMessage('assistant', messageText)]);
    } finally {
      setIsBusy(false);
    }
  }

  if (hidden) {
    return null;
  }

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        aria-label="Open Studio Next AI Assistant"
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#17251f] text-[#d29d42] border border-[#d29d42]/30 shadow-2xl transition hover:scale-105 hover:bg-[#1e2f27]"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Chat Container */}
      {isOpen ? (
        <section className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-[#d29d42]/30 bg-white shadow-2xl font-sans">
          {/* Header */}
          <header className="bg-[#17251f] px-4 py-3.5 text-white flex items-center justify-between border-b border-[#d29d42]/20">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d29d42]/20 text-[#d29d42]">
                <Bot size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-serif text-sm font-semibold tracking-wide text-white">STUDIO NEXT AI</p>
                  <Sparkles size={12} className="text-[#d29d42]" />
                </div>
                <p className="text-[11px] text-[#84a395]">CAD/CAM & Cutting Room Automation</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Quick Actions */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-neutral-100 bg-[#f9f8f6] px-3 py-2 scrollbar-hide">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => void sendChatMessage(action)}
                  className="shrink-0 rounded-full border border-[#d29d42]/40 bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] transition hover:bg-[#17251f] hover:text-[#d29d42]"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#faf9f6] px-3.5 py-3.5" style={{ overscrollBehavior: 'contain' }}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                    message.role === 'assistant'
                      ? 'bg-white text-[#374151] border border-neutral-200/80 shadow-xs'
                      : 'ml-auto bg-[#17251f] text-white border border-[#d29d42]/30'
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {isBusy && (
                <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs text-[#374151] border border-neutral-200/80 shadow-xs w-fit">
                  <Loader2 size={14} className="animate-spin text-[#d29d42]" />
                  <span>Searching Studio Next knowledge base...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendChatMessage(draft);
              }}
              className="border-t border-neutral-100 bg-white px-3 py-3"
            >
              <div className="flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about software, machinery, address..."
                  className="flex-1 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs sm:text-sm outline-none focus:border-[#d29d42] transition-colors text-[#374151]"
                />
                <button
                  type="submit"
                  disabled={isBusy || !draft.trim()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17251f] text-[#d29d42] transition hover:bg-[#1e2f27] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </>
  );
}
