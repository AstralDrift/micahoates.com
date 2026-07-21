"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

import { primaryCase, secondaryCases } from "@/lib/case-studies";
import { site } from "@/lib/site-content";

export function SelectedWork() {
  const listRef = useRef<HTMLUListElement>(null);
  const [caseOpen, setCaseOpen] = useState(true);
  const casePanelId = useId();

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const rows = [...list.querySelectorAll<HTMLElement>(".selected-work-row")];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    for (const row of rows) {
      observer.observe(row);
    }

    return () => observer.disconnect();
  }, []);

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

      <ul ref={listRef} className="selected-work-list">
        {site.work.map((entry, index) => {
          const href = "href" in entry ? entry.href : undefined;
          const status = "status" in entry ? entry.status : undefined;
          const ordinal = String(index + 1).padStart(2, "0");

          return (
            <li
              key={entry.id}
              className="selected-work-row"
              style={{ "--row-index": index } as CSSProperties}
            >
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

      <article className="case-study" aria-labelledby="case-study-title">
        <div className="case-study-head">
          <p className="selected-work-overline">Case study</p>
          <h3 id="case-study-title" className="case-study-title">
            {primaryCase.title}
          </h3>
          <p className="case-study-summary">{primaryCase.summary}</p>
          <button
            type="button"
            className="case-study-toggle"
            aria-expanded={caseOpen}
            aria-controls={casePanelId}
            onClick={() => setCaseOpen((open) => !open)}
          >
            {caseOpen ? "Collapse" : "Expand"} mechanism
          </button>
        </div>
        {caseOpen ? (
          <div id={casePanelId} className="case-study-panel">
            <div className="case-study-block">
              <h4>Problem</h4>
              <p>{primaryCase.problem}</p>
            </div>
            <div className="case-study-block">
              <h4>Trust boundary</h4>
              <p>{primaryCase.boundary}</p>
            </div>
            <div className="case-study-block">
              <h4>Mechanism</h4>
              <p>{primaryCase.mechanism}</p>
            </div>
            <div className="case-study-block">
              <h4>What still breaks</h4>
              <p>{primaryCase.stillBreaks}</p>
            </div>
            {primaryCase.href ? (
              <a className="case-study-link" href={primaryCase.href} target="_blank" rel="noreferrer noopener">
                View repository ↗
              </a>
            ) : null}
          </div>
        ) : null}
      </article>

      <div className="secondary-cases">
        {secondaryCases.map((entry) => (
          <article key={entry.id} className="secondary-case">
            <div className="selected-work-meta">
              <h3 className="selected-work-name">{entry.title}</h3>
              <span className="selected-work-status">{entry.status}</span>
            </div>
            <p className="selected-work-blurb">{entry.summary}</p>
            <p className="secondary-case-boundary">{entry.boundary}</p>
          </article>
        ))}
      </div>

      <div className="also-built">
        <p className="selected-work-overline">Also</p>
        <ul className="also-built-list">
          {site.also.map((entry) => (
            <li key={entry.id}>
              {entry.href ? (
                <a href={entry.href} target="_blank" rel="noreferrer noopener">
                  {entry.name}
                </a>
              ) : (
                entry.name
              )}
              <span> — {entry.blurb}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
