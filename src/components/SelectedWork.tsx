"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { site } from "@/lib/site-content";

export function SelectedWork() {
  const listRef = useRef<HTMLUListElement>(null);

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
    </section>
  );
}
