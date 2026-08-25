import { useState, useRef, useEffect } from "react";
import { useNavigationStore } from "@/stores/navigation";
import { useExperimentStore } from "@/stores/experiment";
import { getExperiment } from "@/experiments/registry";

interface ChatMessage {
  id: number;
  role: "user" | "galileo";
  content: string;
  timestamp: number;
}

function renderFormattedInline(str: string) {
  // Regex to split by bold (**...**) and inline code (`...`)
  const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-[#e5e2e1]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="bg-[#131313] text-[#8da399] px-1 py-0.5 rounded font-data-mono text-[11px] border border-[#424845]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function formatChatMessageContent(raw: string) {
  // 1. Comprehensive LaTeX and math artifact cleanup
  const clean = raw
    // LaTeX fractions: \frac{a}{b} or frac{a}{b} -> a / b
    .replace(/\\?frac\{([^}]+)\}\{([^}]+)\}/g, "$1 / $2")
    .replace(/\\?text\{([^}]+)\}/g, "$1")
    .replace(/\\?text\b/g, "")
    .replace(/\\?propto\b/g, "∝")
    .replace(/\\?implies\b/g, "⟹")
    .replace(/\\?iff\b/g, "⟺")
    .replace(/\\?quad\b/g, "   ")
    .replace(/\\?qquad\b/g, "    ")
    .replace(/\\?times\b/g, "×")
    .replace(/\\?cdot\b/g, "·")
    .replace(/\\?pm\b/g, "±")
    .replace(/\\?mp\b/g, "∓")
    .replace(/\\?approx\b/g, "≈")
    .replace(/\\?Delta\b/g, "Δ")
    .replace(/\\?Omega\b/g, "Ω")
    .replace(/\\?ohm\b/g, "Ω")
    .replace(/\\?mu\b/g, "µ")
    .replace(/\\?micro\b/g, "µ")
    .replace(/10\^\{?-3\}?|10\^-3/g, "10⁻³")
    .replace(/10\^\{?-6\}?|10\^-6/g, "10⁻⁶")
    .replace(/10\^\{?2\}?|10\^2/g, "10²")
    .replace(/10\^\{?3\}?|10\^3/g, "10³")
    .replace(/\$/g, ""); // strip raw LaTeX dollar signs

  const lines = clean.split("\n");

  return (
    <div className="space-y-1.5 break-words min-w-0 max-w-full text-xs md:text-sm leading-relaxed">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lIdx} className="h-1" />;
        }

        // Section / Numbered Headers (e.g. "1. Theoretical Principle" or "### Title")
        if (trimmed.startsWith("###") || trimmed.startsWith("##")) {
          const headerText = trimmed.replace(/^#+\s*/, "");
          return (
            <div key={lIdx} className="font-headline-sm font-semibold text-[#8da399] pt-1.5 pb-0.5">
              {renderFormattedInline(headerText)}
            </div>
          );
        }

        if (/^\d+[\.\)]\s+/.test(trimmed)) {
          return (
            <div key={lIdx} className="font-headline-sm font-semibold text-[#8da399] pt-1.5 pb-0.5">
              {renderFormattedInline(trimmed)}
            </div>
          );
        }

        // Bullet points (* or -)
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const bulletContent = trimmed.replace(/^[*•-]\s+/, "");
          return (
            <div key={lIdx} className="flex items-start gap-2 pl-1 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8da399] mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0 break-words">
                {renderFormattedInline(bulletContent)}
              </div>
            </div>
          );
        }

        // Highlighted formula lines (contains ∝ or ⟹)
        if (trimmed.includes("∝") || trimmed.includes("⟹")) {
          return (
            <div key={lIdx} className="bg-[#131313] border border-[#383838] px-2.5 py-1.5 rounded font-data-mono text-xs text-[#b5ccc1] my-1 break-words">
              {renderFormattedInline(trimmed)}
            </div>
          );
        }

        // Normal paragraph
        return (
          <div key={lIdx} className="break-words min-w-0">
            {renderFormattedInline(line)}
          </div>
        );
      })}
    </div>
  );
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 0,
  role: "galileo",
  content:
    "Hello! I am GALILEO, your virtual laboratory AI assistant. I am connected to your live telemetry stream. You can ask questions about the current apparatus setup, theoretical equations, or request real-time data analysis.",
  timestamp: 0,
};

export default function GalileoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false); // Default to uncrowded, with easy toggle
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const idCounter = useRef(1);

  const experimentId = useNavigationStore((s) => s.activeExperimentId);
  const apparatusValues = useExperimentStore((s) => s.apparatusValues);
  const observations = useExperimentStore((s) => s.observations);
  const chatContextKey = useExperimentStore((s) => s.chatContextKey);
  const sessionStatus = useExperimentStore((s) => s.sessionStatus);
  const validationMessages = useExperimentStore((s) => s.validationMessages);

  const entry = experimentId ? getExperiment(experimentId) : undefined;

  useEffect(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput("");
  }, [chatContextKey]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const sendQuery = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: ++idCounter.current,
      role: "user",
      content: trimmed,
      timestamp: 0,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const context = {
        experimentId: experimentId || "ohms-law",
        experimentTitle: entry?.config.title || "Ohm's Law",
        aim: entry?.config.aim,
        sessionStatus,
        validationMessages,
        apparatusValues,
        observations: observations.map((obs) => ({
          inputs: obs.inputs,
          outputs: obs.outputs,
        })),
        aiVerbosity: (await import("@/stores/settings")).useSettingsStore.getState().aiVerbosity,
      };

      const res = await fetch("/api/galileo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, context }),
      });

      const data = await res.json();

      const galileoMsg: ChatMessage = {
        id: ++idCounter.current,
        role: "galileo",
        content: data.reply || "No response received from GALILEO service.",
        timestamp: 0,
      };

      setMessages((prev) => [...prev, galileoMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: ++idCounter.current,
        role: "galileo",
        content: `Error communicating with GALILEO: ${
          err instanceof Error ? err.message : "Failed to connect to proxy."
        }`,
        timestamp: 0,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  const quickPrompts = experimentId === "titration-analysis" ? [
    "Verify equivalence point calculation",
    "Explain the pH curve shape",
    "What is the indicator color transition?"
  ] : experimentId === "series-parallel" ? [
    "Verify Kirchhoff's laws",
    "Calculate equivalent resistance",
    "Explain the current distribution"
  ] : [
    "Verify Ohm's Law linearity from observations",
    "How does resistance affect the slope in V-I plot?",
    "Calculate theoretical power dissipation",
  ];

  return (
    <div className="h-full w-full max-w-full bg-[#20201f] flex flex-col overflow-hidden overflow-x-hidden text-[#e5e2e1] font-body-md">
      {/* ── AI Header ── */}
      <div className="p-3.5 border-b border-[#424845] flex items-center justify-between bg-[#1a1a1a] shrink-0 max-w-full overflow-hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
            <span
              className="material-symbols-outlined text-[#8da399] text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smart_toy
            </span>
          </div>
          <div>
            <h2 className="font-label-caps text-xs text-[#8da399] m-0 tracking-widest font-semibold">
              AI ASSISTANT
            </h2>
            <div className="font-body-md text-[#c2c8c4] text-[11px] opacity-75 leading-none">
              Insight Engine
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Suggested Prompts */}
          <button
            type="button"
            onClick={() => setShowSuggestions(!showSuggestions)}
            className={`px-2 py-1 rounded text-[10px] font-label-caps border transition-colors flex items-center gap-1 cursor-pointer ${
              showSuggestions
                ? "bg-[#8da399]/20 text-[#8da399] border-[#8da399]/40"
                : "bg-[#131313] text-[#c2c8c4] border-[#424845] hover:text-[#e5e2e1]"
            }`}
            title={showSuggestions ? "Hide suggested prompts" : "Show suggested prompts"}
          >
            <span className="material-symbols-outlined text-[13px]">
              {showSuggestions ? "lightbulb" : "lightbulb_outline"}
            </span>
            {showSuggestions ? "Hide Prompts" : "Prompts"}
          </button>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#131313] border border-[#424845]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8da399] animate-pulse" />
            <span className="font-label-caps text-[9px] text-[#8da399]">LIVE</span>
          </div>
        </div>
      </div>

      {/* ── Chat Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Messages List */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            } gap-1`}
          >
            {/* Header / Sender Label */}
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              {msg.role === "user" ? (
                <>
                  <span className="font-label-caps text-[9px] text-[#c2c8c4]">
                    RESEARCHER
                  </span>
                  <div className="w-4 h-4 rounded bg-[#353535] flex items-center justify-center border border-[#424845]">
                    <span className="material-symbols-outlined text-[11px] text-[#c2c8c4]">
                      person
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
                    <span
                      className="material-symbols-outlined text-[11px] text-[#8da399]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      smart_toy
                    </span>
                  </div>
                  <span className="font-label-caps text-[9px] text-[#8da399] font-semibold">
                    GALILEO
                  </span>
                </>
              )}
            </div>

            {/* Bubble Content */}
            <div
              className={`text-xs md:text-sm font-body-md rounded-lg p-3 leading-relaxed shadow-sm min-w-0 break-words ${
                msg.role === "user"
                  ? "bg-[#1a1a1a] border border-[#333333] rounded-tr-none text-[#e5e2e1] max-w-[90%]"
                  : "bg-[#2a2a2a] border border-[#333333] rounded-tl-none text-[#e5e2e1] max-w-[96%]"
              }`}
            >
              {formatChatMessageContent(msg.content)}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              <div className="w-4 h-4 rounded bg-[#8da399]/20 flex items-center justify-center border border-[#8da399]/30">
                <span className="material-symbols-outlined text-[11px] text-[#8da399]">
                  smart_toy
                </span>
              </div>
              <span className="font-label-caps text-[9px] text-[#8da399]">
                GALILEO
              </span>
            </div>
            <div className="bg-[#2a2a2a] border border-[#333333] rounded-lg rounded-tl-none p-3 max-w-[90%] text-xs font-data-mono text-[#c2c8c4] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#8da399] animate-ping" />
              Analyzing telemetry & computing formulation...
            </div>
          </div>
        )}
      </div>

      {/* ── Optional Collapsible Quick Prompts Strip (Fully Responsive) ── */}
      {showSuggestions && (
        <div className="px-3 py-2.5 border-t border-[#424845]/60 bg-[#1c1b1b] flex flex-col gap-2 shrink-0 animate-in fade-in duration-150 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-label-caps text-[#c2c8c4]/80 px-0.5">
            <span>SUGGESTED INQUIRIES</span>
            <button
              type="button"
              onClick={() => setShowSuggestions(false)}
              className="text-[#c2c8c4] hover:text-[#e5e2e1] cursor-pointer flex items-center gap-0.5"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
              Dismiss
            </button>
          </div>
          <div className="flex flex-col gap-1.5 w-full min-w-0">
            {quickPrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendQuery(prompt)}
                disabled={isLoading}
                className="w-full text-left text-[11px] font-label-caps bg-[#262626] hover:bg-[#353535] border border-[#333333] hover:border-[#8da399]/40 rounded-lg p-2 text-[#c2c8c4] hover:text-[#e5e2e1] transition-all flex items-start gap-2 cursor-pointer disabled:opacity-50 min-w-0 group"
              >
                <span className="material-symbols-outlined text-[14px] text-[#8da399] shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  science
                </span>
                <span className="break-words whitespace-normal flex-1 leading-snug">
                  {prompt}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input Area ── */}
      <div className="p-3 border-t border-[#424845] bg-[#1a1a1a] shrink-0">
        {/* Text Input Container */}
        <div className="relative flex items-center">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Ask a question about this experiment..."
            className="w-full bg-[#131313] border border-[#333333] rounded text-sm text-[#e5e2e1] font-body-md p-2.5 pr-10 resize-none focus:outline-none focus:border-[#8da399] transition-colors placeholder:text-[#c2c8c4]/40"
          />
          <button
            type="button"
            onClick={() => sendQuery(input)}
            disabled={isLoading || !input.trim()}
            className="absolute bottom-2.5 right-2.5 text-[#c2c8c4] hover:text-[#8da399] transition-colors p-1.5 bg-[#353535] hover:bg-[#424845] rounded flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </div>

        {/* Footer shortcuts */}
        <div className="mt-1.5 flex justify-between items-center px-1">
          <span className="font-data-mono text-[10px] text-[#c2c8c4]/50">
            Markdown supported
          </span>
          <span className="font-data-mono text-[10px] text-[#c2c8c4]/50">
            Enter to send
          </span>
        </div>
      </div>
    </div>
  );
}
