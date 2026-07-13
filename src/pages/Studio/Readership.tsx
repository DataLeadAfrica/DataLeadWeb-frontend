import { useEffect, useState } from "react";

import "./readership.css";
import { ReadershipRow, fetchReadership } from "../../lib/supabase";

function shortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function num(n: number): string {
  return (n || 0).toLocaleString("en");
}

function pct(reads: number, views: number): number {
  if (!views) return 0;
  return Math.round((reads / views) * 100);
}

export default function Readership({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<ReadershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchReadership().then((res) => {
      if (!active) return;
      if (res.ok) setRows(res.rows);
      else setError(res.message);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalViews = rows.reduce((s, r) => s + r.views, 0);
  const totalReads = rows.reduce((s, r) => s + r.reads, 0);
  const readThrough = pct(totalReads, totalViews);

  return (
    <div className="rd">
      <div className="rd__head">
        <button className="rd__back" onClick={onDone}>
          &larr; Back
        </button>
        <h1>Readership</h1>
        <p>
          How your published articles are being read. Anonymous counts, no
          personal data is stored.
        </p>
      </div>

      {loading ? (
        <div className="rd__empty">Loading...</div>
      ) : error ? (
        <div className="rd__err">
          Could not load readership: {error}
        </div>
      ) : (
        <>
          <div className="rd__summary">
            <div className="rd__stat">
              <div className="rd__stat-label">Total views</div>
              <div className="rd__stat-num">{num(totalViews)}</div>
            </div>
            <div className="rd__stat">
              <div className="rd__stat-label">Read to the end</div>
              <div className="rd__stat-num">{num(totalReads)}</div>
            </div>
            <div className="rd__stat">
              <div className="rd__stat-label">Read-through</div>
              <div className="rd__stat-num rd__stat-num--accent">
                {readThrough}%
              </div>
            </div>
            <div className="rd__stat">
              <div className="rd__stat-label">Live articles</div>
              <div className="rd__stat-num">{num(rows.length)}</div>
            </div>
          </div>

          <div className="rd__section-row">
            <span className="rd__section">By article</span>
            <span className="rd__sorted">Sorted by views</span>
          </div>

          {rows.length === 0 ? (
            <div className="rd__empty">No published articles yet.</div>
          ) : (
            <div className="rd__list">
              {rows.map((r) => {
                const rate = pct(r.reads, r.views);
                return (
                  <div className="rd__item" key={r.slug}>
                    <div className="rd__item-top">
                      <div
                        className="rd__thumb"
                        style={
                          r.cover_url
                            ? { backgroundImage: `url(${r.cover_url})` }
                            : undefined
                        }
                      />
                      <div className="rd__info">
                        <a
                          className="rd__title"
                          href={"/blog/" + r.slug}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.title}
                        </a>
                        <div className="rd__meta">
                          {(r.category ? r.category + " · " : "") +
                            shortDate(r.published_at)}
                        </div>
                      </div>
                      {r.category && (
                        <span className="rd__chip">{r.category}</span>
                      )}
                    </div>
                    <div className="rd__metrics">
                      <span className="rd__metric">
                        {num(r.views)} views
                      </span>
                      <span className="rd__metric">
                        {num(r.reads)} read to end
                      </span>
                      <span className="rd__rate">
                        <span className="rd__bar">
                          <span
                            className="rd__bar-fill"
                            style={{ width: rate + "%" }}
                          />
                        </span>
                        <b>{rate}%</b>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="rd__note">
            A view is counted when the article opens. A read is counted when a
            visitor scrolls to the end. Counts are anonymous and update as
            people visit.
          </p>
        </>
      )}
    </div>
  );
}
