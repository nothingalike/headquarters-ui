import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { askedItems, isAnswered, isTodo } from "../../../shared/reports.ts";
import type { Answer, AnswersFile, ReportItem, TodoReport } from "../../../shared/types.ts";
import { api } from "../api.ts";
import { Markdown } from "../components/Markdown.tsx";
import { formatDate, relativeTime } from "../paths.ts";
import type { ReportViewProps } from "./registry.tsx";

type SaveState = "saving" | "saved" | "error";
type AnswerInput = Omit<Answer, "at">;

export function TodoReportView({ bundle }: ReportViewProps) {
  const report = bundle.report as TodoReport;
  const [answers, setAnswers] = useState(bundle.answers.answers);
  const [status, setStatus] = useState<Record<string, SaveState>>({});
  const dirty = useRef(new Set<string>());
  const location = useLocation();

  // Take answers written elsewhere (another tab, an agent), but keep any text the user is still typing.
  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...bundle.answers.answers };
      for (const id of dirty.current) if (prev[id]) next[id] = prev[id];
      return next;
    });
  }, [bundle.answers]);

  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("flash");
  }, [location.hash]);

  if (!isTodo(report)) return null;

  const save = async (id: string, input: AnswerInput) => {
    setStatus((s) => ({ ...s, [id]: "saving" }));
    setAnswers((a) => ({ ...a, [id]: { ...input, at: new Date().toISOString() } }));
    try {
      const file = await api<AnswersFile>("/api/answers", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: bundle.path, id, answer: input }),
      });
      dirty.current.delete(id);
      setAnswers((prev) => {
        const next = { ...file.answers };
        for (const d of dirty.current) if (prev[d]) next[d] = prev[d];
        return next;
      });
      setStatus((s) => ({ ...s, [id]: "saved" }));
    } catch {
      setStatus((s) => ({ ...s, [id]: "error" }));
    }
  };

  const asked = askedItems(report);
  const answered = asked.filter(({ item }) => isAnswered(item, answers[item.id])).length;

  return (
    <article className="todo-report">
      <header className="page-head">
        <div className="kicker">
          {[report.project, report.story, report.created && formatDate(report.created, true)].filter(Boolean).join(" · ")}
        </div>
        <h1>{report.title}</h1>
        {report.summary && (
          <div className="lede prose">
            <Markdown base={bundle.path}>{report.summary}</Markdown>
          </div>
        )}
        {asked.length > 0 && (
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={asked.length} aria-valuenow={answered} aria-label="Answered">
            <div className="progress-bar">
              <span style={{ width: `${(answered / asked.length) * 100}%` }} />
            </div>
            <span className="progress-label">
              {answered} of {asked.length} answered
            </span>
          </div>
        )}
      </header>

      {report.sections.map((section, si) => {
        const sectionAsked = section.items.filter((i) => i.ask);
        const sectionDone = sectionAsked.filter((i) => isAnswered(i, answers[i.id])).length;
        return (
          <section key={section.id} className="todo-section" id={`section-${section.id}`}>
            <h2>
              <span className="n">{si + 1}</span>
              {section.title}
              {sectionAsked.length > 0 && <span className="count">{sectionDone}/{sectionAsked.length}</span>}
            </h2>
            {section.intro && (
              <div className="prose section-intro">
                <Markdown base={bundle.path}>{section.intro}</Markdown>
              </div>
            )}
            <ol className="todo-items">
              {section.items.map((item) => (
                <TodoItem key={item.id} item={item} base={bundle.path} answer={answers[item.id]} state={status[item.id]} onSave={(input) => save(item.id, input)} onDirty={() => dirty.current.add(item.id)} />
              ))}
            </ol>
          </section>
        );
      })}
    </article>
  );
}

type ItemProps = {
  item: ReportItem;
  base: string;
  answer?: Answer;
  state?: SaveState;
  onSave: (input: AnswerInput) => void;
  onDirty: () => void;
};

function TodoItem({ item, base, answer, state, onSave, onDirty }: ItemProps) {
  const done = isAnswered(item, answer);
  const [note, setNote] = useState(answer?.text ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(answer?.text));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setNote(answer?.text ?? "");
  }, [answer?.text]);

  const current = (): AnswerInput => ({ done: answer?.done, choice: answer?.choice, text: note });

  const saveText = (text: string) => {
    clearTimeout(timer.current);
    onSave({ ...current(), text });
  };

  const typeText = (text: string) => {
    editing.current = true;
    setNote(text);
    onDirty();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveText(text), 800);
  };

  const textBox = (
    <textarea
      className="answer-text"
      rows={item.ask === "text" ? 3 : 2}
      placeholder={item.ask === "text" ? "Your answer" : "Add a note (optional)"}
      value={note}
      onChange={(e) => typeText(e.target.value)}
      onBlur={() => {
        editing.current = false;
        if (note !== (answer?.text ?? "")) saveText(note);
      }}
      aria-label={item.ask === "text" ? "Answer" : "Note"}
    />
  );

  return (
    <li id={item.id} className={`todo-item ${item.ask ? `ask-${item.ask}` : "info"} ${done ? "done" : ""}`}>
      <div className="todo-row">
        {item.ask === "check" ? (
          <input type="checkbox" className="todo-check" checked={answer?.done === true} onChange={(e) => onSave({ ...current(), done: e.target.checked })} aria-label="Done" />
        ) : (
          <span className={`todo-marker ${item.ask ? "" : "info"}`} aria-hidden />
        )}
        <div className="todo-body">
          <div className="todo-text prose">
            <Markdown base={base}>{item.text}</Markdown>
          </div>
          {item.waitingOn && <span className="pill warn">Waiting on {item.waitingOn}</span>}
          {item.detail && <Detail markdown={item.detail} base={base} />}

          {item.ask === "choice" && (
            <div className="choices" role="radiogroup" aria-label="Choose one">
              {item.options?.map((option) => (
                <label key={option} className={`choice ${answer?.choice === option ? "on" : ""}`}>
                  <input type="radio" name={item.id} checked={answer?.choice === option} onChange={() => onSave({ ...current(), choice: option })} />
                  {option}
                </label>
              ))}
              {answer?.choice && (
                <button className="link-button" onClick={() => onSave({ ...current(), choice: undefined })}>
                  Clear
                </button>
              )}
            </div>
          )}

          {item.ask === "text" && textBox}
          {(item.ask === "check" || item.ask === "choice") &&
            (noteOpen ? (
              textBox
            ) : (
              <button className="link-button" onClick={() => setNoteOpen(true)}>
                Add a note
              </button>
            ))}

          {item.ask && (
            <div className="answer-status" aria-live="polite">
              {state === "saving" && "Saving…"}
              {state === "error" && <span className="bad-text">Not saved. Is the server running?</span>}
              {state !== "saving" && state !== "error" && answer?.at && `Saved ${relativeTime(answer.at)}`}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Detail({ markdown, base }: { markdown: string; base: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked; the text is on screen to select */
    }
  };
  return (
    <div className="todo-detail">
      <button className="copy-button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <div className="prose">
        <Markdown base={base}>{markdown}</Markdown>
      </div>
    </div>
  );
}
