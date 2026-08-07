import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, User as UserIcon, Sparkles, ShieldCheck } from "lucide-react";
import { sendChatMessage } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "AI Support — Nexa Bank" }] }),
  component: SupportPage,
});

type Msg = { id: string; role: "user" | "bot"; text: string };

const suggestions = [
  "Why did my transaction fail?",
  "Is my money safe?",
  "Has my payment been processed?",
  "How do I block my card?",
];

function SupportPage() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "m0",
      role: "bot",
      text: "Hi Aarav 👋 I'm Nexa Assistant. I'm here to help with anything — transactions, cards, payments, or account security. What can I do for you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || typing) return;

    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text: clean };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      // Express enriches this with RAG runbook context, then forwards to n8n Shield agent
      const reply = await sendChatMessage(clean);
      setMessages((m) => [...m, { id: `b${Date.now()}`, role: "bot", text: reply }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          id: `b${Date.now()}`,
          role: "bot",
          text: "I'm having a brief moment of difficulty. Please try again in a moment — I'm here to help.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm text-muted-foreground">Help center</div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1 flex items-center gap-2">
          Nexa Assistant <Sparkles className="h-6 w-6 text-primary" />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Instant answers, powered by our AI support team.</p>
      </motion.div>

      <div className="rounded-3xl glass-strong flex flex-col h-[70vh]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                    m.role === "bot"
                      ? "bg-[image:var(--gradient-primary)] text-primary-foreground"
                      : "bg-[image:var(--gradient-accent)] text-white"
                  }`}
                >
                  {m.role === "bot" ? <Bot className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === "bot" ? "glass" : "bg-primary/20 border border-primary/30"
                  }`}
                >
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {typing && (
            <div className="flex gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="glass rounded-2xl px-4 py-3 flex items-center gap-1">
                <Dot /><Dot delay={0.15} /><Dot delay={0.3} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-4 space-y-3">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full glass px-3 py-1.5 text-xs hover:bg-white/10">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={typing}
              className="flex-1 h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm outline-none focus:border-primary/60 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={typing || !input.trim()}
              className="h-11 w-11 grid place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground hover:brightness-110 disabled:opacity-60"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Chats are private, encrypted, and reviewed only with your consent.
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay = 0 }: { delay?: number }) {
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-foreground/60"
      animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1, repeat: Infinity, delay }}
    />
  );
}


