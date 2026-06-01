import type { ReactNode } from "react";

type QuietSystemMessageProps = {
  label: string;
  title: string;
  detail: string;
  action: ReactNode;
};

export function QuietSystemMessage({ label, title, detail, action }: QuietSystemMessageProps) {
  return (
    <main className="quiet-interface quiet-interface-centered">
      <section className="quiet-terminal quiet-terminal-message" aria-labelledby="system-message-title">
        <div className="quiet-terminal-chrome" aria-hidden="true">
          <span>state</span>
          <strong>{label}</strong>
          <span>?</span>
        </div>
        <div className="quiet-terminal-output">
          <p className="quiet-line-muted">SYSTEM INTERFACE</p>
          <br />
          <p className="quiet-line-input" id="system-message-title">
            {title}
          </p>
          <p className="quiet-line-default">{detail}</p>
        </div>
        <div className="quiet-terminal-command">
          <div className="quiet-terminal-hint">return channel available</div>
          <div className="quiet-terminal-form quiet-terminal-action">
            <span aria-hidden="true">&gt;</span>
            {action}
          </div>
        </div>
      </section>
    </main>
  );
}
