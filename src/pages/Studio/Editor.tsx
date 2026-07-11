import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import "./editor.css";
import {
  Post,
  uploadImage,
  estimateReadMinutes,
  savePost,
  updatePostContent,
  approvePost,
  rejectPost,
  unpublishPost,
  deletePost,
} from "../../lib/supabase";

const CATEGORIES = ["Career", "Learning", "Tools", "Skills", "Impact", "News"];

function longDate(d: string | null): string {
  if (!d) return "Draft";
  return new Date(d).toLocaleString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Editor({
  authorEmail,
  authorName,
  onDone,
  initialPost,
  isAdmin,
}: {
  authorEmail: string;
  authorName: string;
  onDone: () => void;
  initialPost?: Post | null;
  isAdmin?: boolean;
}) {
  const editing = !!initialPost;

  const [mode, setMode] = useState<"preview" | "edit">(
    editing ? "preview" : "edit",
  );
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [category, setCategory] = useState(
    initialPost?.category ?? CATEGORIES[0],
  );
  const [tags, setTags] = useState((initialPost?.tags ?? []).join(", "));
  const [coverUrl, setCoverUrl] = useState<string | null>(
    initialPost?.cover_url ?? null,
  );
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false }), Image],
    content: initialPost?.body || "<p>Start writing your article...</p>",
  });

  // Make sure the post's own category is always an option in the dropdown.
  const cats = CATEGORIES.includes(category)
    ? CATEGORIES
    : [category, ...CATEGORIES];

  const tagList = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  async function insertInlineImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const url = await uploadImage(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
    e.target.value = "";
  }

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    const url = await uploadImage(file);
    setCoverUrl(url);
    setCoverBusy(false);
    e.target.value = "";
  }

  function addLink() {
    if (!editor) return;
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  // ---- Author flow: create a new post or update own, then set status ----
  async function submit(status: "draft" | "pending") {
    if (!editor) return;
    if (!title.trim()) {
      setMsg({ ok: false, text: "Please add a title." });
      return;
    }
    setBusy(true);
    setMsg(null);
    const html = editor.getHTML();
    const res = await savePost(
      {
        id: initialPost?.id,
        title,
        excerpt,
        body: html,
        cover_url: coverUrl,
        category,
        tags: tagList,
        read_minutes: estimateReadMinutes(html),
        authorEmail,
        authorName,
      },
      status,
    );
    setBusy(false);
    if (res.ok) {
      setMsg({
        ok: true,
        text:
          status === "pending"
            ? "Submitted for review. An admin will approve it before it goes live."
            : "Saved as draft.",
      });
      setTimeout(onDone, 1200);
    } else {
      setMsg({ ok: false, text: res.message });
    }
  }

  // ---- Admin flow: save content without touching status ----
  async function saveContentOnly(): Promise<boolean> {
    if (!editor || !initialPost) return false;
    if (!title.trim()) {
      setMsg({ ok: false, text: "Please add a title." });
      return false;
    }
    const html = editor.getHTML();
    const res = await updatePostContent(initialPost.id, {
      title,
      excerpt,
      body: html,
      cover_url: coverUrl,
      category,
      tags: tagList,
      read_minutes: estimateReadMinutes(html),
    });
    if (!res.ok) setMsg({ ok: false, text: res.message });
    return res.ok;
  }

  async function onSaveChanges() {
    setBusy(true);
    setMsg(null);
    const ok = await saveContentOnly();
    setBusy(false);
    if (ok) setMsg({ ok: true, text: "Changes saved." });
  }

  async function onApprove() {
    if (!initialPost) return;
    setBusy(true);
    setMsg(null);
    const ok = await saveContentOnly();
    if (ok) await approvePost(initialPost.id);
    setBusy(false);
    if (ok) {
      setMsg({ ok: true, text: "Approved and published." });
      setTimeout(onDone, 1000);
    }
  }

  async function onSendBack() {
    if (!initialPost) return;
    const note = window.prompt("Add a note for the author (optional):") || "";
    setBusy(true);
    setMsg(null);
    const ok = await saveContentOnly();
    if (ok) await rejectPost(initialPost.id, note);
    setBusy(false);
    if (ok) {
      setMsg({ ok: true, text: "Sent back to the author." });
      setTimeout(onDone, 1000);
    }
  }

  async function onUnpublish() {
    if (!initialPost) return;
    setBusy(true);
    setMsg(null);
    const ok = await saveContentOnly();
    if (ok) await unpublishPost(initialPost.id);
    setBusy(false);
    if (ok) {
      setMsg({ ok: true, text: "Unpublished." });
      setTimeout(onDone, 1000);
    }
  }

  async function onDelete() {
    if (!initialPost) return;
    if (
      !window.confirm(
        "Delete this article permanently? This cannot be undone.",
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    const res = await deletePost(initialPost.id);
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Deleted." });
      setTimeout(onDone, 800);
    } else {
      setMsg({ ok: false, text: res.message });
    }
  }

  if (!editor) return <div className="ed-loading">Loading editor...</div>;

  const tb = (active: boolean) => "ed-tb" + (active ? " on" : "");
  const html = editor.getHTML();
  const readMin = estimateReadMinutes(html) || 1;
  const isPublished = initialPost?.status === "published";
  const adminBar = editing && isAdmin;

  return (
    <div className="ed">
      <div className="ed__head ed__head--row">
        <div>
          <button className="ed__back" onClick={onDone}>
            &larr; Back
          </button>
          <h1>{editing ? "Review article" : "Write an article"}</h1>
          <p>
            {editing
              ? "See how it will look, edit if needed, then choose an action."
              : "Compose your article, add a cover image, then submit it for review."}
          </p>
        </div>
        <div className="ed__seg">
          <button
            className={mode === "preview" ? "on" : ""}
            onClick={() => setMode("preview")}
          >
            Preview
          </button>
          <button
            className={mode === "edit" ? "on" : ""}
            onClick={() => setMode("edit")}
          >
            Edit
          </button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="ed__pv">
          <div className="ed__pv-meta">
            <span className="ed__pv-chip">{category || "Uncategorised"}</span>
            <span>&middot;</span>
            <span>{readMin} min read</span>
            <span>&middot;</span>
            <span>{longDate(initialPost?.published_at ?? null)}</span>
          </div>
          <h1>{title || "Untitled article"}</h1>
          <div className="ed__pv-byline">
            <div className="ed__pv-avatar" />
            <div>
              {(authorName || initialPost?.author || authorEmail) +
                " \u00b7 Data-Lead Africa"}
            </div>
          </div>
          {coverUrl ? (
            <div className="ed__pv-cover">
              <img src={coverUrl} alt={title} />
            </div>
          ) : (
            <div className="ed__pv-cover ed__pv-cover--empty">
              No cover image on this article
            </div>
          )}
          {excerpt && <p className="ed__pv-lead">{excerpt}</p>}
          <div
            className="ed__pv-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        <div className="ed__grid">
          <div className="ed__main">
            <div className="ed__toolbar">
              <button
                className={tb(editor.isActive("bold"))}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
              >
                <b>B</b>
              </button>
              <button
                className={tb(editor.isActive("italic"))}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
              >
                <i>I</i>
              </button>
              <button
                className={tb(editor.isActive("heading", { level: 2 }))}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
                title="Heading"
              >
                H
              </button>
              <button className="ed-tb" onClick={addLink} title="Link">
                &#128279;
              </button>
              <button
                className={tb(editor.isActive("bulletList"))}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet list"
              >
                &#8226;
              </button>
              <button
                className={tb(editor.isActive("orderedList"))}
                onClick={() =>
                  editor.chain().focus().toggleOrderedList().run()
                }
                title="Numbered list"
              >
                1.
              </button>
              <button
                className={tb(editor.isActive("blockquote"))}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Quote"
              >
                &#8220;
              </button>
              <label className="ed-tb" title="Insert image">
                &#128247;
                <input
                  type="file"
                  accept="image/*"
                  onChange={insertInlineImage}
                  hidden
                />
              </label>
            </div>

            <input
              className="ed__title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
            />
            <EditorContent editor={editor} className="ed__body" />
          </div>

          <div className="ed__side">
            <div className="ed__panel">
              <label>Cover image</label>
              <label className="ed__cover">
                {coverBusy ? (
                  "Uploading..."
                ) : coverUrl ? (
                  <img src={coverUrl} alt="cover" />
                ) : (
                  <span>Click to upload (shows on the blog card)</span>
                )}
                <input type="file" accept="image/*" onChange={onCover} hidden />
              </label>

              <label>Short excerpt (for the card)</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                placeholder="One or two sentences summarising the article."
              />

              <label>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {cats.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>

              <label>Tags (comma separated)</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="data, career, excel"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      {adminBar ? (
        <div className="ed__bar">
          <span className="ed__bar-who">Admin actions</span>
          <button
            className="ed-act ed-act--save"
            onClick={onSaveChanges}
            disabled={busy}
          >
            {busy ? "Working..." : "Save changes"}
          </button>
          {isPublished ? (
            <button
              className="ed-act ed-act--danger"
              onClick={onUnpublish}
              disabled={busy}
            >
              Unpublish
            </button>
          ) : (
            <>
              <button
                className="ed-act ed-act--approve"
                onClick={onApprove}
                disabled={busy}
              >
                Approve &amp; publish
              </button>
              <button
                className="ed-act ed-act--danger"
                onClick={onSendBack}
                disabled={busy}
              >
                Send back
              </button>
            </>
          )}
          <button
            className="ed-act ed-act--delete"
            onClick={onDelete}
            disabled={busy}
          >
            &#128465; Delete
          </button>
          {msg && (
            <p className={msg.ok ? "ed__ok" : "ed__err"}>{msg.text}</p>
          )}
        </div>
      ) : (
        <div className="ed__bar">
          <span className="ed__bar-who">
            {editing ? "Update your article" : "Ready to submit"}
          </span>
          <button
            className="ed-act ed-act--primary"
            onClick={() => submit("pending")}
            disabled={busy}
          >
            {busy ? "Saving..." : "Submit for review"}
          </button>
          <button
            className="ed-act ed-act--save"
            onClick={() => submit("draft")}
            disabled={busy}
          >
            Save as draft
          </button>
          {msg && (
            <p className={msg.ok ? "ed__ok" : "ed__err"}>{msg.text}</p>
          )}
          <p className="ed__note">
            Your article shows as <b>Pending</b> until an admin approves it.
          </p>
        </div>
      )}
    </div>
  );
}
