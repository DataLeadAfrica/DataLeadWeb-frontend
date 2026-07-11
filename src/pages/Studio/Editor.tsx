import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import "./editor.css";
import {
  uploadImage,
  estimateReadMinutes,
  savePost,
} from "../../lib/supabase";

const CATEGORIES = ["Career", "Learning", "Tools", "Skills", "Impact", "News"];

export default function Editor({
  authorEmail,
  authorName,
  onDone,
}: {
  authorEmail: string;
  authorName: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [tags, setTags] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: "<p>Start writing your article...</p>",
  });

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

  async function save(status: "draft" | "pending") {
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
        title,
        excerpt,
        body: html,
        cover_url: coverUrl,
        category,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
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

  if (!editor) return <div className="ed-loading">Loading editor...</div>;

  const tb = (active: boolean) => "ed-tb" + (active ? " on" : "");

  return (
    <div className="ed">
      <div className="ed__head">
        <button className="ed__back" onClick={onDone}>
          &larr; Back
        </button>
        <h1>Write an article</h1>
        <p>
          Compose your article, add a cover image, then submit it for review.
        </p>
      </div>

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
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
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
              {CATEGORIES.map((c) => (
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

          <div className="ed__panel ed__actions">
            <button
              className="studio-btn"
              onClick={() => save("pending")}
              disabled={busy}
            >
              {busy ? "Saving..." : "Submit for review"}
            </button>
            <button
              className="ed__draft"
              onClick={() => save("draft")}
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
        </div>
      </div>
    </div>
  );
}
