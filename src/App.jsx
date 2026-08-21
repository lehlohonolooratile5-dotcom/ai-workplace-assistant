import React, { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Mail,
  FileText,
  ListChecks,
  Search,
  MessageSquare,
  Menu,
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Clock,
} from "lucide-react";

/* ============================================================
   AI WORKPLACE PRODUCTIVITY ASSISTANT
   Design tokens: see <style> block below.
   ============================================================ */

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "email", label: "Email Generator", icon: Mail },
  { id: "meeting", label: "Meeting Notes", icon: FileText },
  { id: "planner", label: "Task Planner", icon: ListChecks },
  { id: "research", label: "Research Assistant", icon: Search },
  { id: "chat", label: "AI Chatbot", icon: MessageSquare },
];

const DISCLAIMER = "AI-generated content may require human review";

/* ---------------- Claude API helper ---------------- */
async function callClaude(system, userContent, maxTokens = 1000) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: Array.isArray(userContent)
        ? userContent
        : [{ role: "user", content: userContent }],
    }),
  });
  if (!response.ok) throw new Error("The assistant could not be reached. Please try again.");
  const data = await response.json();
  const text = (data.content || [])
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("No response was generated. Please try again.");
  return text;
}

/* ---------------- Signature loading indicator: "the Pulse" ---------------- */
function Pulse({ label = "Thinking" }) {
  return (
    <div className="pulse-wrap" role="status" aria-live="polite">
      <span className="pulse-dot d1" />
      <span className="pulse-dot d2" />
      <span className="pulse-dot d3" />
      <span className="pulse-label">{label}</span>
    </div>
  );
}

/* ---------------- Disclaimer chip ---------------- */
function Disclaimer({ compact }) {
  return (
    <div className={"disclaimer" + (compact ? " disclaimer-compact" : "")}>
      <ShieldAlert size={13} strokeWidth={2.2} />
      <span>{DISCLAIMER}</span>
    </div>
  );
}

/* ---------------- Lightweight markdown-ish renderer ---------------- */
function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    )
  );
}

function LiteMarkdown({ text }) {
  if (!text) return null;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length) {
      const Tag = listType === "ol" ? "ol" : "ul";
      blocks.push(
        <Tag className="md-list" key={`list-${blocks.length}`}>
          {listBuffer.map((item, idx) => (
            <li key={idx}>{inlineFormat(item)}</li>
          ))}
        </Tag>
      );
      listBuffer = [];
      listType = null;
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      flushList();
      i++;
      continue;
    }

    // table block
    if (line.includes("|") && line.split("|").filter(Boolean).length >= 2) {
      const tableLines = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines.filter((l) => !/^\|?\s*-{2,}/.test(l.replace(/\|/g, "")));
      const cellsOf = (l) =>
        l
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));
      const header = cellsOf(rows[0]);
      const body = rows.slice(1).map(cellsOf);
      flushList();
      blocks.push(
        <div className="md-table-wrap" key={`table-${blocks.length}`}>
          <table className="md-table">
            <thead>
              <tr>
                {header.map((h, idx) => (
                  <th key={idx}>{inlineFormat(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ridx) => (
                <tr key={ridx}>
                  {r.map((c, cidx) => (
                    <td key={cidx}>{inlineFormat(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^#{1,4}\s+/.test(line)) {
      flushList();
      const level = line.match(/^#+/)[0].length;
      const content = line.replace(/^#{1,4}\s+/, "");
      const Tag = level <= 2 ? "h4" : "h5";
      blocks.push(
        <Tag className="md-heading" key={`h-${blocks.length}`}>
          {inlineFormat(content)}
        </Tag>
      );
      i++;
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      if (listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(line.replace(/^[-•*]\s+/, ""));
      i++;
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(line.replace(/^\d+[.)]\s+/, ""));
      i++;
      continue;
    }

    flushList();
    blocks.push(
      <p className="md-p" key={`p-${blocks.length}`}>
        {inlineFormat(line)}
      </p>
    );
    i++;
  }
  flushList();
  return <div className="md-body">{blocks}</div>;
}

/* ---------------- Output card with copy ---------------- */
function OutputCard({ content, loading, loadingLabel, error, emptyHint }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="card output-card">
      <div className="output-head">
        <div className="output-title">
          <Sparkles size={15} />
          <span>AI Output</span>
        </div>
        {content && !loading && (
          <button className="btn-ghost-sm" onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <div className="output-body">
        {loading && <Pulse label={loadingLabel} />}
        {!loading && error && <p className="error-text">{error}</p>}
        {!loading && !error && content && <LiteMarkdown text={content} />}
        {!loading && !error && !content && <p className="empty-hint">{emptyHint}</p>}
      </div>
      {content && !loading && !error && (
        <div className="output-foot">
          <Disclaimer compact />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PAGE: Dashboard
   ============================================================ */
function DashboardPage({ go }) {
  const cards = [
    {
      id: "email",
      icon: Mail,
      title: "Smart Email Generator",
      desc: "Draft polished emails matched to tone and audience in seconds.",
    },
    {
      id: "meeting",
      icon: FileText,
      title: "Meeting Notes Summarizer",
      desc: "Turn raw notes into key points, action items and deadlines.",
    },
    {
      id: "planner",
      icon: ListChecks,
      title: "AI Task Planner",
      desc: "Prioritize your task list and get a realistic schedule.",
    },
    {
      id: "research",
      icon: Search,
      title: "AI Research Assistant",
      desc: "Get structured insights and summaries on any topic.",
    },
    {
      id: "chat",
      icon: MessageSquare,
      title: "AI Chatbot",
      desc: "Ask quick work questions and get practical answers.",
    },
  ];
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Good to see you</h1>
          <p className="page-sub">Pick a tool below to automate today's work.</p>
        </div>
      </div>

      <div className="grid-cards">
        {cards.map((c) => (
          <button key={c.id} className="card feature-card" onClick={() => go(c.id)}>
            <div className="feature-icon">
              <c.icon size={18} />
            </div>
            <div className="feature-copy">
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
            </div>
            <ArrowRight size={16} className="feature-arrow" />
          </button>
        ))}
      </div>

      <div className="card note-card">
        <Clock size={16} />
        <p>
          Every tool here uses structured prompts to keep AI output clear and professional. Review
          anything important before you send or act on it.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: Smart Email Generator
   ============================================================ */
function EmailPage() {
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState("Formal");
  const [audience, setAudience] = useState("Manager");
  const [points, setPoints] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");

  const buildSystemPrompt = () =>
    `You are a professional workplace email-writing assistant.
Write ONE complete, ready-to-send email based on the user's purpose, key points, tone and audience.

Formatting rules:
- Start with "Subject: " on its own line.
- Then a blank line, then the email body.
- Use a greeting appropriate to the audience, short clear paragraphs, and a professional sign-off (use a generic closing like "Best regards," with no placeholder name unless one was given).
- Match the requested tone precisely: ${tone}.
- Write for this audience: ${audience}.
- Do not add commentary before or after the email. Output only the email.`;

  const handleGenerate = async () => {
    if (!purpose.trim()) {
      setError("Add a purpose or topic for the email first.");
      return;
    }
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const userMsg = `Purpose/topic: ${purpose}\nKey points to include: ${
        points || "(none specified — infer reasonable content from the purpose)"
      }`;
      const text = await callClaude(buildSystemPrompt(), userMsg, 700);
      setOutput(text);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={Mail}
        title="Smart Email Generator"
        sub="Generate a tone- and audience-matched email draft."
      />
      <div className="two-col">
        <div className="card form-card">
          <Field label="Purpose / topic">
            <textarea
              rows={3}
              placeholder="e.g. Following up on the Q3 budget review meeting"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </Field>
          <div className="field-row">
            <Field label="Tone">
              <select value={tone} onChange={(e) => setTone(e.target.value)}>
                {["Formal", "Friendly", "Persuasive", "Assertive", "Empathetic"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Audience">
              <select value={audience} onChange={(e) => setAudience(e.target.value)}>
                {["Client", "Manager", "Team", "External Partner"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Key points (optional)">
            <textarea
              rows={4}
              placeholder="One per line — e.g. thank them for their time, confirm next steps, propose a follow-up date"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </Field>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "Generating…" : "Generate email"}
          </button>
        </div>

        <OutputCard
          content={output}
          loading={loading}
          loadingLabel="Drafting email"
          error={error}
          emptyHint="Your generated email will appear here."
        />
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: Meeting Notes Summarizer
   ============================================================ */
function MeetingPage() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");

  const system = `You are a meeting notes summarizer for busy professionals.
Given raw meeting notes or a transcript, produce a structured summary with exactly these three sections, using "## " headings:
## Key Points
## Action Items
## Decisions Made

- Key Points: concise bullets covering what was discussed.
- Action Items: bullets, each stating the task, the owner if mentioned (otherwise write "Owner: unassigned"), and the deadline if mentioned (otherwise write "Deadline: not specified").
- Decisions Made: concise bullets of what was agreed or decided.
Only use information present in the notes — never invent names, dates or facts. If a section has nothing relevant, write "None noted."`;

  const handleGenerate = async () => {
    if (!notes.trim()) {
      setError("Paste your meeting notes or transcript first.");
      return;
    }
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const text = await callClaude(system, notes, 900);
      setOutput(text);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={FileText}
        title="Meeting Notes Summarizer"
        sub="Paste raw notes or a transcript to get key points, actions and deadlines."
      />
      <div className="two-col">
        <div className="card form-card">
          <Field label="Meeting notes / transcript">
            <textarea
              rows={14}
              placeholder="Paste your raw notes or transcript here…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "Summarizing…" : "Summarize notes"}
          </button>
        </div>
        <OutputCard
          content={output}
          loading={loading}
          loadingLabel="Reading notes"
          error={error}
          emptyHint="Your structured summary will appear here."
        />
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: AI Task Planner
   ============================================================ */
function PlannerPage() {
  const [tasks, setTasks] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");

  const system = `You are an AI task-planning assistant.
Given a list of tasks (one per line) and optional context about the person's day, prioritize the tasks using urgency and importance, then propose a realistic schedule.

Output format:
1. A markdown table with columns: Priority | Task | Suggested Time Block | Notes
   - Priority values must be exactly one of: High, Medium, Low.
2. After the table, a short "## Recommended approach" section with 2-3 sentences of practical advice.
Do not invent tasks that were not listed. Keep suggested time blocks realistic for a single workday.`;

  const handleGenerate = async () => {
    const list = tasks.trim();
    if (!list) {
      setError("List at least one task first.");
      return;
    }
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const userMsg = `Tasks:\n${list}\n\nContext: ${context || "(none provided)"}`;
      const text = await callClaude(system, userMsg, 900);
      setOutput(text);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={ListChecks}
        title="AI Task Planner"
        sub="Get your task list prioritized and scheduled."
      />
      <div className="two-col">
        <div className="card form-card">
          <Field label="Tasks (one per line)">
            <textarea
              rows={8}
              placeholder={"Finish client proposal\nReview budget spreadsheet\nReply to vendor email\nPrep slides for Friday standup"}
              value={tasks}
              onChange={(e) => setTasks(e.target.value)}
            />
          </Field>
          <Field label="Context (optional)">
            <textarea
              rows={3}
              placeholder="e.g. Working hours 9am–5pm, client proposal is due tomorrow morning"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </Field>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "Planning…" : "Build my schedule"}
          </button>
        </div>
        <OutputCard
          content={output}
          loading={loading}
          loadingLabel="Prioritizing tasks"
          error={error}
          emptyHint="Your prioritized schedule will appear here."
        />
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: AI Research Assistant
   ============================================================ */
function ResearchPage() {
  const [topic, setTopic] = useState("");
  const [depth, setDepth] = useState("Quick overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");

  const system = `You are an AI research assistant for busy professionals.
Given a topic or question, produce a structured brief using "## " headings, in this exact order:
## Overview
## Key Insights
## Considerations & Risks
## Suggested Next Steps

- Overview: 2-3 sentences of plain-language framing.
- Key Insights: 3-5 bullets.
- Considerations & Risks: 2-3 bullets.
- Suggested Next Steps: 2-3 bullets.
Match depth to this request: ${depth}. Be factual and measured; do not fabricate statistics, sources, or citations — note plainly where something would need independent verification.`;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError("Add a topic or question first.");
      return;
    }
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const text = await callClaude(system, topic, 900);
      setOutput(text);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon={Search}
        title="AI Research Assistant"
        sub="Get a structured brief on any work topic."
      />
      <div className="two-col">
        <div className="card form-card">
          <Field label="Topic or question">
            <textarea
              rows={4}
              placeholder="e.g. What should we consider before adopting a 4-day work week?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Field label="Depth">
            <select value={depth} onChange={(e) => setDepth(e.target.value)}>
              <option>Quick overview</option>
              <option>Detailed brief</option>
            </select>
          </Field>
          <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "Researching…" : "Get insights"}
          </button>
        </div>
        <OutputCard
          content={output}
          loading={loading}
          loadingLabel="Gathering insights"
          error={error}
          emptyHint="Your research brief will appear here."
        />
      </div>
    </div>
  );
}

/* ============================================================
   PAGE: AI Chatbot
   ============================================================ */
function ChatPage() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I'm your workplace assistant. Ask me to help draft something, plan your day, or think through a work problem.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const system = `You are a workplace productivity assistant embedded in a dashboard app called "AI Workplace Productivity Assistant". Help with work-related questions, drafting, planning and quick advice. Be concise, professional and practical. Use short paragraphs or bullets over long prose.`;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await callClaude(system, apiMessages, 700);
      setMessages((cur) => [...cur, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="page page-chat">
      <PageHeader icon={MessageSquare} title="AI Chatbot" sub="Quick work help, on demand." />
      <div className="card chat-card">
        <div className="chat-log">
          {messages.map((m, idx) => (
            <div key={idx} className={"chat-msg " + (m.role === "user" ? "chat-user" : "chat-assistant")}>
              <div className="chat-bubble">
                {m.role === "assistant" ? <LiteMarkdown text={m.content} /> : m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-msg chat-assistant">
              <div className="chat-bubble chat-loading">
                <Pulse label="Thinking" />
              </div>
            </div>
          )}
          {error && <p className="error-text chat-error">{error}</p>}
          <div ref={endRef} />
        </div>
        <div className="chat-input-row">
          <textarea
            rows={1}
            placeholder="Ask anything about your work day…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="btn-primary btn-send" onClick={handleSend} disabled={loading || !input.trim()}>
            <Send size={15} />
          </button>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}

/* ---------------- Shared small components ---------------- */
function PageHeader({ icon: Icon, title, sub }) {
  return (
    <div className="page-head">
      <div className="page-head-icon">
        <Icon size={17} />
      </div>
      <div>
        <h1>{title}</h1>
        <p className="page-sub">{sub}</p>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/* ============================================================
   APP SHELL
   ============================================================ */
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const go = (id) => {
    setPage(id);
    setMobileNavOpen(false);
  };

  const activeItem = NAV_ITEMS.find((n) => n.id === page);

  return (
    <div className="app-shell">
      <style>{CSS}</style>

      {/* Sidebar */}
      <aside className={"sidebar" + (mobileNavOpen ? " sidebar-open" : "")}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-pulse" aria-hidden="true" />
            <span className="brand-text">
              AI Workplace
              <br />
              Productivity Assistant
            </span>
          </div>
          <button className="icon-btn mobile-only" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={"nav-item" + (page === item.id ? " nav-item-active" : "")}
              onClick={() => go(item.id)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Disclaimer compact />
        </div>
      </aside>

      {mobileNavOpen && <div className="scrim" onClick={() => setMobileNavOpen(false)} />}

      {/* Main */}
      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <span className="topbar-crumb">{activeItem?.label || "Dashboard"}</span>
          <span className="topbar-spacer" />
          <span className="topbar-disclaimer desktop-only">
            <ShieldAlert size={13} />
            {DISCLAIMER}
          </span>
        </header>

        <main className="main-content">
          {page === "dashboard" && <DashboardPage go={go} />}
          {page === "email" && <EmailPage />}
          {page === "meeting" && <MeetingPage />}
          {page === "planner" && <PlannerPage />}
          {page === "research" && <ResearchPage />}
          {page === "chat" && <ChatPage />}
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   STYLES — design tokens
   ink        #12172B   primary text / deep surfaces
   paper      #F4F5F7   app background
   surface    #FFFFFF   cards
   border     #E3E6EC
   muted      #67707E   secondary text
   brand      #26305E   primary / sidebar
   brand-2    #1A2246   sidebar deep
   accent     #E2A63B   signal amber (pulse, highlights only)
   teal       #1F9E82   secondary accent / success
   Display face: Sora — Body: Inter — Mono: JetBrains Mono
   ============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');

:root{
  --ink:#0B0D12;
  --paper:#F3F4F7;
  --surface:#FFFFFF;
  --border:#E1E3E9;
  --muted:#5B6270;
  --brand:#1D4ED8;
  --brand-2:#05070C;
  --accent:#2F6FFF;
  --accent-soft:#DCE6FF;
  --teal:#1F9E82;
  --danger:#C24C42;
  --radius:12px;
  --shadow:0 1px 2px rgba(5,7,12,0.05), 0 8px 24px rgba(5,7,12,0.06);
}

*{ box-sizing:border-box; }
.app-shell{
  min-height:100vh;
  width:100%;
  display:flex;
  background:var(--paper);
  color:var(--ink);
  font-family:'Inter', system-ui, sans-serif;
  font-size:14.5px;
  line-height:1.55;
}
.desktop-only{ display:inline-flex; }
.mobile-only{ display:none; }

/* ---------- Sidebar ---------- */
.sidebar{
  width:250px;
  flex-shrink:0;
  background:linear-gradient(180deg, var(--brand-2), var(--brand));
  color:#EDEFF7;
  display:flex;
  flex-direction:column;
  padding:20px 14px;
  gap:18px;
}
.sidebar-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:8px; padding:0 4px; }
.brand{ display:flex; align-items:flex-start; gap:9px; }
.brand-pulse{
  width:9px; height:9px; border-radius:50%; margin-top:6px; flex-shrink:0;
  background:var(--accent);
  box-shadow:0 0 0 0 rgba(226,166,59,0.6);
  animation: brandPulse 2.4s ease-in-out infinite;
}
@keyframes brandPulse{
  0%{ box-shadow:0 0 0 0 rgba(226,166,59,0.55); }
  70%{ box-shadow:0 0 0 8px rgba(226,166,59,0); }
  100%{ box-shadow:0 0 0 0 rgba(226,166,59,0); }
}
.brand-text{ font-family:'Sora', sans-serif; font-weight:600; font-size:13.5px; letter-spacing:0.01em; line-height:1.3; }

.nav{ display:flex; flex-direction:column; gap:2px; flex:1; margin-top:4px; }
.nav-item{
  display:flex; align-items:center; gap:10px;
  padding:9px 12px; border-radius:9px;
  background:transparent; border:none; cursor:pointer;
  color:#C7CCE3; font-size:13.5px; font-weight:500;
  text-align:left; font-family:inherit;
  transition:background .15s ease, color .15s ease;
  border-left:2px solid transparent;
}
.nav-item:hover{ background:rgba(255,255,255,0.06); color:#fff; }
.nav-item-active{
  background:rgba(226,166,59,0.14);
  color:#fff;
  border-left:2px solid var(--accent);
}
.sidebar-foot{ padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); }

/* ---------- Main column ---------- */
.main-col{ flex:1; min-width:0; display:flex; flex-direction:column; }
.topbar{
  height:56px; flex-shrink:0;
  display:flex; align-items:center; gap:10px;
  padding:0 22px;
  background:var(--surface);
  border-bottom:1px solid var(--border);
}
.topbar-crumb{ font-family:'Sora', sans-serif; font-weight:600; font-size:14px; }
.topbar-spacer{ flex:1; }
.topbar-disclaimer{
  display:inline-flex; align-items:center; gap:6px;
  font-size:12px; color:var(--muted);
}
.icon-btn{
  background:none; border:none; cursor:pointer; color:inherit;
  display:flex; align-items:center; justify-content:center;
  padding:6px; border-radius:8px;
}
.icon-btn:hover{ background:rgba(0,0,0,0.05); }
.sidebar .icon-btn:hover{ background:rgba(255,255,255,0.1); }

.main-content{ flex:1; padding:26px 28px 48px; overflow-y:auto; }
.page{ max-width:1080px; margin:0 auto; display:flex; flex-direction:column; gap:20px; }

.page-head{ display:flex; align-items:center; gap:12px; margin-bottom:2px; }
.page-head-icon{
  width:34px; height:34px; border-radius:9px;
  background:var(--brand); color:#fff;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.page h1{ font-family:'Sora', sans-serif; font-size:19px; font-weight:600; margin:0; }
.page-sub{ margin:2px 0 0; color:var(--muted); font-size:13px; }

/* ---------- Cards ---------- */
.card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
}
.grid-cards{
  display:grid; grid-template-columns:repeat(auto-fill, minmax(230px,1fr));
  gap:14px;
}
.feature-card{
  padding:18px; text-align:left; cursor:pointer;
  display:flex; flex-direction:column; gap:10px; align-items:flex-start;
  font-family:inherit; color:inherit;
  transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  position:relative;
}
.feature-card:hover{ transform:translateY(-2px); border-color:#D5D9E3; box-shadow:0 4px 14px rgba(18,23,43,0.08); }
.feature-icon{
  width:32px; height:32px; border-radius:8px;
  background:var(--accent-soft); color:#8A5F16;
  display:flex; align-items:center; justify-content:center;
}
.feature-copy h3{ font-family:'Sora', sans-serif; font-size:14.5px; margin:0 0 4px; }
.feature-copy p{ margin:0; font-size:12.5px; color:var(--muted); line-height:1.5; }
.feature-arrow{ position:absolute; top:18px; right:16px; color:#B7BCCB; }

.note-card{
  display:flex; align-items:flex-start; gap:10px;
  padding:14px 16px; color:var(--muted); font-size:12.8px;
}
.note-card svg{ flex-shrink:0; margin-top:2px; color:var(--accent); }

/* ---------- Forms ---------- */
.two-col{ display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
.form-card{ padding:18px; display:flex; flex-direction:column; gap:14px; }
.field{ display:flex; flex-direction:column; gap:6px; }
.field-row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.field-label{ font-size:12px; font-weight:600; color:var(--ink); }
textarea, select, input[type="text"]{
  font-family:inherit; font-size:13.5px; color:var(--ink);
  border:1px solid var(--border); border-radius:8px;
  padding:9px 11px; resize:vertical; background:#FBFBFC;
  transition:border-color .15s ease, background .15s ease;
}
textarea:focus, select:focus, input:focus{
  outline:2px solid var(--accent); outline-offset:1px;
  border-color:var(--accent); background:#fff;
}
select{ appearance:auto; cursor:pointer; }

.btn-primary{
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  background:var(--brand); color:#fff; border:none;
  font-family:inherit; font-weight:600; font-size:13.5px;
  padding:10px 16px; border-radius:9px; cursor:pointer;
  transition:background .15s ease, opacity .15s ease;
  align-self:flex-start;
}
.btn-primary:hover:not(:disabled){ background:var(--brand-2); }
.btn-primary:disabled{ opacity:0.6; cursor:not-allowed; }
.btn-ghost-sm{
  display:inline-flex; align-items:center; gap:5px;
  background:none; border:1px solid var(--border); color:var(--muted);
  font-family:inherit; font-size:12px; font-weight:500;
  padding:5px 9px; border-radius:7px; cursor:pointer;
}
.btn-ghost-sm:hover{ background:var(--paper); color:var(--ink); }

/* ---------- Output card ---------- */
.output-card{ display:flex; flex-direction:column; min-height:280px; }
.output-head{
  display:flex; align-items:center; justify-content:space-between;
  padding:13px 16px; border-bottom:1px solid var(--border);
}
.output-title{ display:flex; align-items:center; gap:7px; font-family:'Sora', sans-serif; font-weight:600; font-size:13px; color:var(--brand); }
.output-body{ padding:16px; flex:1; display:flex; flex-direction:column; justify-content:flex-start; }
.output-foot{ padding:0 16px 14px; }
.empty-hint{ color:#9AA1B0; font-size:13px; margin:auto 0; }
.error-text{ color:var(--danger); font-size:13px; }

/* ---------- Markdown-lite render ---------- */
.md-body{ display:flex; flex-direction:column; gap:8px; }
.md-heading{ font-family:'Sora', sans-serif; font-size:14px; font-weight:600; margin:6px 0 -2px; color:var(--brand); }
.md-p{ margin:0; font-size:13.5px; }
.md-list{ margin:0; padding-left:18px; display:flex; flex-direction:column; gap:5px; font-size:13.5px; }
.md-table-wrap{ overflow-x:auto; }
.md-table{ border-collapse:collapse; width:100%; font-size:13px; }
.md-table th, .md-table td{ border:1px solid var(--border); padding:7px 10px; text-align:left; }
.md-table th{ background:var(--paper); font-family:'Sora', sans-serif; font-weight:600; font-size:12px; }
.md-table td:first-child{ font-weight:600; }

/* ---------- Pulse loader ---------- */
.pulse-wrap{ display:flex; align-items:center; gap:8px; margin:auto 0; padding:6px 2px; }
.pulse-dot{ width:7px; height:7px; border-radius:50%; background:var(--accent); animation: pulseDot 1.1s ease-in-out infinite; }
.d2{ animation-delay:0.15s; } .d3{ animation-delay:0.3s; }
@keyframes pulseDot{ 0%,80%,100%{ transform:scale(0.6); opacity:0.4; } 40%{ transform:scale(1); opacity:1; } }
.pulse-label{ font-size:12.5px; color:var(--muted); font-family:'JetBrains Mono', monospace; }

/* ---------- Disclaimer ---------- */
.disclaimer{
  display:flex; align-items:center; gap:6px;
  font-size:11.5px; color:#B9C0D6; line-height:1.4;
}
.disclaimer-compact{ color:var(--muted); }

/* ---------- Chat ---------- */
.page-chat{ height:100%; }
.chat-card{ display:flex; flex-direction:column; height:60vh; min-height:420px; }
.chat-log{ flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; }
.chat-msg{ display:flex; }
.chat-user{ justify-content:flex-end; }
.chat-assistant{ justify-content:flex-start; }
.chat-bubble{
  max-width:78%; padding:10px 13px; border-radius:12px; font-size:13.5px;
}
.chat-user .chat-bubble{ background:var(--brand); color:#fff; border-bottom-right-radius:3px; }
.chat-assistant .chat-bubble{ background:var(--paper); border:1px solid var(--border); border-bottom-left-radius:3px; }
.chat-loading{ padding:10px 13px; }
.chat-error{ padding:0 4px; }
.chat-input-row{
  display:flex; align-items:flex-end; gap:8px;
  padding:12px 16px; border-top:1px solid var(--border);
}
.chat-input-row textarea{ flex:1; max-height:120px; }
.btn-send{ padding:10px; align-self:flex-end; }

/* ---------- Scrollbars (subtle) ---------- */
.main-content::-webkit-scrollbar, .chat-log::-webkit-scrollbar{ width:8px; }
.main-content::-webkit-scrollbar-thumb, .chat-log::-webkit-scrollbar-thumb{ background:#D5D9E3; border-radius:8px; }

/* ---------- Responsive ---------- */
@media (max-width: 880px){
  .desktop-only{ display:none; }
  .mobile-only{ display:flex; }
  .sidebar{
    position:fixed; inset:0 auto 0 0; z-index:40;
    transform:translateX(-100%); transition:transform .2s ease;
    width:78vw; max-width:280px; height:100vh;
  }
  .sidebar-open{ transform:translateX(0); }
  .scrim{ position:fixed; inset:0; background:rgba(18,23,43,0.4); z-index:30; }
  .two-col{ grid-template-columns:1fr; }
  .field-row{ grid-template-columns:1fr; }
  .main-content{ padding:18px 16px 40px; }
  .grid-cards{ grid-template-columns:1fr; }
}
`;
