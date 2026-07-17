import { site } from "@/lib/site-content";

export function SelectedWork() {
  return (
    <section id="selected-work" className="selected-work" aria-labelledby="selected-work-title">
      <p className="selected-work-overline">Selected work</p>
      <h2 id="selected-work-title" className="selected-work-title">
        Systems in the field
      </h2>
      <ul className="selected-work-list">
        {site.work.map((entry) => {
          const href = "href" in entry ? entry.href : undefined;

          return (
            <li key={entry.id} className="selected-work-row">
              <div className="selected-work-meta">
                {href ? (
                  <a className="selected-work-name" href={href} target="_blank" rel="noreferrer noopener">
                    {entry.name}
                  </a>
                ) : (
                  <span className="selected-work-name">{entry.name}</span>
                )}
                {"status" in entry && entry.status ? (
                  <span className="selected-work-status">{entry.status}</span>
                ) : null}
              </div>
              <p className="selected-work-blurb">{entry.blurb}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
