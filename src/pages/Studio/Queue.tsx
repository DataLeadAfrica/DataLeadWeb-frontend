import { useEffect, useState } from "react";

import "./queue.css";
import {
  Post,
  fetchAdminPosts,
  approvePost,
  rejectPost,
  unpublishPost,
  deletePost,
} from "../../lib/supabase";

function shortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Queue({
  onDone,
  onOpen,
}: {
  onDone: () => void;
  onOpen: (post: Post) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setPosts(await fetchAdminPosts());
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function onApprove(id: string) {
    setBusyId(id);
    await approvePost(id);
    await load();
    setBusyId(null);
  }
  async function onReject(id: string) {
    const note = window.prompt("Add a note for the author (optional):") || "";
    setBusyId(id);
    await rejectPost(id, note);
    await load();
    setBusyId(null);
  }
  async function onUnpublish(id: string) {
    setBusyId(id);
    await unpublishPost(id);
    await load();
    setBusyId(null);
  }
  async function onDelete(id: string) {
    if (
      !window.confirm("Delete this article permanently? This cannot be undone.")
    )
      return;
    setBusyId(id);
    await deletePost(id);
    await load();
    setBusyId(null);
  }

  const pending = posts.filter((p) => p.status === "pending");
  const live = posts.filter((p) => p.status === "published");
  const other = posts.filter(
    (p) => p.status !== "pending" && p.status !== "published",
  );

  function statusClass(s: string) {
    if (s === "pending") return "q-status q-status--pending";
    if (s === "published") return "q-status q-status--live";
    if (s === "rejected") return "q-status q-status--rejected";
    return "q-status q-status--draft";
  }

  function Row({ p }: { p: Post }) {
    const busy = busyId === p.id;
    return (
      <div className="q-item">
        <div
          className="q-thumb"
          style={
            p.cover_url ? { backgroundImage: `url(${p.cover_url})` } : undefined
          }
        />
        <div className="q-info">
          <h3>{p.title}</h3>
          <div className="q-meta">
            by {p.author_email || p.author || "unknown"} ·{" "}
            {shortDate(p.updated_at || p.created_at)}
            {p.category ? " · " + p.category : ""} ·{" "}
            {p.read_minutes || 5} min
          </div>
          {p.status === "rejected" && p.review_note && (
            <div className="q-note">Sent back: {p.review_note}</div>
          )}
        </div>
        <span className={statusClass(p.status)}>{p.status}</span>
        <div className="q-actions">
          <button
            className="q-btn q-btn--open"
            onClick={() => onOpen(p)}
            disabled={busy}
          >
            Open
          </button>
          {p.status === "published" ? (
            <>
              <a
                className="q-btn q-btn--ghost"
                href={"/blog/" + p.slug}
                target="_blank"
                rel="noreferrer"
              >
                View
              </a>
              <button
                className="q-btn q-btn--reject"
                onClick={() => onUnpublish(p.id)}
                disabled={busy}
              >
                Unpublish
              </button>
            </>
          ) : (
            <>
              <button
                className="q-btn q-btn--approve"
                onClick={() => onApprove(p.id)}
                disabled={busy}
              >
                {busy ? "..." : "Approve & publish"}
              </button>
              <button
                className="q-btn q-btn--reject"
                onClick={() => onReject(p.id)}
                disabled={busy}
              >
                Send back
              </button>
            </>
          )}
          <button
            className="q-btn q-btn--delete"
            onClick={() => onDelete(p.id)}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="q">
      <div className="q__head">
        <button className="q__back" onClick={onDone}>
          &larr; Back
        </button>
        <h1>Approval queue</h1>
        <p>
          Review articles submitted by staff. Open to preview or edit, approve
          to publish live, send back with a note, or delete.
        </p>
      </div>

      {loading ? (
        <div className="q__empty">Loading...</div>
      ) : (
        <>
          <h2 className="q__section">
            Pending review{pending.length ? ` (${pending.length})` : ""}
          </h2>
          {pending.length === 0 ? (
            <div className="q__empty">Nothing waiting for review.</div>
          ) : (
            pending.map((p) => <Row key={p.id} p={p} />)
          )}

          {other.length > 0 && (
            <>
              <h2 className="q__section">Drafts &amp; sent back</h2>
              {other.map((p) => (
                <Row key={p.id} p={p} />
              ))}
            </>
          )}

          <h2 className="q__section">
            Live{live.length ? ` (${live.length})` : ""}
          </h2>
          {live.length === 0 ? (
            <div className="q__empty">No published articles yet.</div>
          ) : (
            live.map((p) => <Row key={p.id} p={p} />)
          )}
        </>
      )}
    </div>
  );
}
