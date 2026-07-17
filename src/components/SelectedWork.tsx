import type { CSSProperties } from "react";

import { site } from "@/lib/site-content";

export function SelectedWork() {
  return (
    <section id="selected-work" className="selected-work" aria-labelledby="selected-work-title">
      <div className="selected-work-head">
        <div>
          <p className="selected-work-overline">Index 01 — selected work</p>
          <h2 id="selected-work-title" className="selected-work-title">
            Systems in the field
          </h2>
        </div>
        <p className="selected-work-aside">
          Public repos when they help. Private when the work is the product.
        </p>
      </div>

      <ul className="selected-work-list">
        {site.work.map((entry, index) => {
          const href = "href" in entry ? entry.href : undefined;
          const status = "status" in entry ? entry.status : undefined;
          const ordinal = String(index + 1).padStart(2, "0");

          return (
            <li key={entry.id} className="selected-work-row" style={{ "--row-index": index } as CSSProperties}>
              <span className="selected-work-index" aria-hidden="true">
                {ordinal}
              </span>
              <div className="selected-work-body">
                <div className="selected-work-meta">
                  {href ? (
                    <a className="selected-work-name" href={href} target="_blank" rel="noreferrer noopener">
                      {entry.name}
                      <span className="selected-work-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ) : (
                    <span className="selected-work-name">{entry.name}</span>
                  )}
                  {status ? <span className="selected-work-status">{status}</span> : null}
                </div>
                <p className="selected-work-blurb">{entry.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
