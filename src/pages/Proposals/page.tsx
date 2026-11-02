import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";

import "./page.css";
import Seo from "../../components/Seo/component";
import {
  ALLOWED_EXTENSIONS,
  CATEGORIES,
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  NOTE_MAX,
  OTHER,
  SUBMIT_URL,
  TYPES,
} from "./config";

// The staff form where a finished proposal is handed in for the
// register. It sits under /staff/, which robots.txt already closes, and
// carries noindex as well, so it is unlisted rather than secret: anybody
// who is given the address can open it.
//
// What the page does and does not do:
//   - It checks every box and shows the problem beside the box.
//   - It sends ONE request to the Google Apps Script web app named in
//     config.ts, with the file travelling as text inside it.
//   - The SERVER adds the reference number and the time. Nothing about
//     either is ever taken from this page, so a wrong clock on somebody's
//     laptop cannot put a wrong time in the register.
//   - It repeats nothing the server decides: the server checks everything
//     again, and its answer is the one that counts.

type FieldKey =
  | "name"
  | "title"
  | "type"
  | "typeOther"
  | "categories"
  | "categoryOther"
  | "client"
  | "deadline"
  | "note"
  | "file";

type Errors = Partial<Record<FieldKey, string>>;

type Reply = {
  ok: boolean;
  reference?: string;
  recordedAt?: string;
  field?: string;
  message?: string;
};

const FIELD_KEYS: string[] = [
  "name",
  "title",
  "type",
  "typeOther",
  "categories",
  "categoryOther",
  "client",
  "deadline",
  "note",
  "file",
];

const NOT_CONFIRMED =
  "We could not confirm that your proposal was received. Please try again. " +
  "Nothing you typed has been cleared.";

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function prettySize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? "" : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
}

// Sent as text/plain on purpose. That is a "simple" request, so the
// browser does not ask Google's server for permission first, which the
// web app cannot answer. XMLHttpRequest rather than fetch, because it
// reports how much of a large file has gone, and a 20 MB upload on a
// slow connection should not look like a frozen page.
function send(
  body: string,
  onProgress: (percent: number) => void,
): Promise<Reply> {
  return new Promise((resolve) => {
    const failed: Reply = { ok: false, field: "form", message: NOT_CONFIRMED };
    const xhr = new XMLHttpRequest();
    xhr.open("POST", SUBMIT_URL);
    xhr.setRequestHeader("Content-Type", "text/plain;charset=utf-8");
    xhr.timeout = 5 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        resolve(JSON.parse(xhr.responseText) as Reply);
      } catch {
        resolve(failed);
      }
    };
    xhr.onerror = () => resolve(failed);
    xhr.ontimeout = () => resolve(failed);
    xhr.send(body);
  });
}

export default function Proposals() {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [typeOther, setTypeOther] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryOther, setCategoryOther] = useState("");
  const [client, setClient] = useState("");
  const [deadline, setDeadline] = useState("");
  const [noDeadline, setNoDeadline] = useState(false);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [trap, setTrap] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [percent, setPercent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [done, setDone] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  // A leave-the-page warning while the file is travelling. Closing the
  // tab half way would lose the upload and leave nothing in the register.
  useEffect(() => {
    if (!sending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sending]);

  // As soon as somebody starts fixing a box, the message about it is no
  // longer true, so it goes.
  function clear(...keys: FieldKey[]) {
    setErrors((old) => {
      const next = { ...old };
      keys.forEach((k) => delete next[k]);
      return next;
    });
    setFormError("");
  }

  function chooseFile(picked: File | undefined | null) {
    if (!picked) return;
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(picked.name))) {
      setFile(null);
      setErrors((old) => ({
        ...old,
        file: "Please choose a PDF, Word or ZIP file.",
      }));
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setErrors((old) => ({
        ...old,
        file: `That file is ${prettySize(picked.size)}. The limit is ${MAX_FILE_LABEL}. Please send a smaller file, or compress it into a ZIP.`,
      }));
      return;
    }
    if (picked.size === 0) {
      setFile(null);
      setErrors((old) => ({ ...old, file: "That file appears to be empty." }));
      return;
    }
    setFile(picked);
    clear("file");
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    chooseFile(e.target.files?.[0]);
    // Lets the same file be chosen again after it was removed.
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (sending) return;
    if (e.dataTransfer.files.length > 1) {
      setErrors((old) => ({
        ...old,
        file: "One file only. If you have several, put them in one ZIP.",
      }));
      return;
    }
    chooseFile(e.dataTransfer.files[0]);
  }

  function toggleCategory(label: string) {
    setCategories((old) =>
      old.includes(label) ? old.filter((c) => c !== label) : [...old, label],
    );
    clear("categories", "categoryOther");
  }

  function check(): Errors {
    const found: Errors = {};
    if (name.trim().length < 2) found.name = "Please enter your full name.";
    if (title.trim().length < 3)
      found.title = "Please enter the title of the proposal.";
    if (!type) found.type = "Please choose a type.";
    if (type === OTHER && typeOther.trim().length < 2)
      found.typeOther = "Please state the type.";
    if (categories.length === 0)
      found.categories = "Please tick at least one category.";
    if (categories.includes(OTHER) && categoryOther.trim().length < 2)
      found.categoryOther = "Please state the category.";
    if (client.trim().length < 2)
      found.client = "Please enter the proposed client organization.";
    if (!noDeadline && !deadline)
      found.deadline =
        'Please enter the submission deadline, or tick "No fixed deadline".';
    if (note.length > NOTE_MAX)
      found.note = `Please keep the note under ${NOTE_MAX} characters.`;
    if (!file) found.file = "Please choose the proposal file to upload.";
    return found;
  }

  function focusFirstProblem() {
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('.pd [data-invalid="true"]')
        ?.focus();
    }, 0);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;

    const found = check();
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) {
      focusFirstProblem();
      return;
    }
    const chosen = file;
    if (!chosen) return;

    setSending(true);
    setPercent(0);

    let fileBase64 = "";
    try {
      fileBase64 = await readAsBase64(chosen);
    } catch {
      setSending(false);
      setErrors({ file: "That file could not be read. Please choose it again." });
      focusFirstProblem();
      return;
    }

    const reply = await send(
      JSON.stringify({
        name: name.trim(),
        title: title.trim(),
        type,
        typeOther: typeOther.trim(),
        categories,
        categoryOther: categoryOther.trim(),
        client: client.trim(),
        deadline,
        noDeadline,
        note: note.trim(),
        fileName: chosen.name,
        fileBase64,
        website: trap,
      }),
      setPercent,
    );
    setSending(false);

    if (reply.ok) {
      setDone(true);
      window.scrollTo({ top: 0 });
      return;
    }

    const message = reply.message || NOT_CONFIRMED;
    if (reply.field && FIELD_KEYS.includes(reply.field)) {
      setErrors({ [reply.field]: message } as Errors);
      focusFirstProblem();
    } else {
      setFormError(message);
    }
  }

  function startAnother() {
    setName("");
    setTitle("");
    setType("");
    setTypeOther("");
    setCategories([]);
    setCategoryOther("");
    setClient("");
    setDeadline("");
    setNoDeadline(false);
    setNote("");
    setFile(null);
    setTrap("");
    setErrors({});
    setFormError("");
    setPercent(0);
    setDone(false);
    window.scrollTo({ top: 0 });
  }

  const seo = (
    <Seo
      title="Proposal submission | Data-Lead Africa"
      description="Submit a finished proposal for the Data-Lead Africa register."
      noindex
    />
  );

  if (done) {
    return (
      <main className="pd">
        {seo}
        <div className="pd__wrap">
          <div className="pd__card pd__done" role="status">
            <span className="pd__tick" aria-hidden="true">
              ✓
            </span>
            <h1 className="pd__h1">Proposal received</h1>
            <button type="button" className="pd__submit" onClick={startAnother}>
              Submit another proposal
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pd">
      {seo}
      <div className="pd__wrap">
        <h1 className="pd__h1">Proposal submission</h1>
        <p className="pd__sub">
          Upload each proposal here once it is ready so it is recorded for
          documentation.
        </p>

        <form className="pd__card" onSubmit={onSubmit} noValidate>
          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-name">
              Your full name <span className="pd__req">*</span>
            </label>
            <input
              id="pd-name"
              className="pd__input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clear("name");
              }}
              autoComplete="name"
              maxLength={100}
              disabled={sending}
              aria-invalid={!!errors.name}
              data-invalid={!!errors.name}
              aria-describedby={errors.name ? "pd-name-err" : undefined}
            />
            {errors.name && (
              <p className="pd__err" id="pd-name-err">
                {errors.name}
              </p>
            )}
          </div>

          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-title">
              Title of proposal <span className="pd__req">*</span>
            </label>
            <input
              id="pd-title"
              className="pd__input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clear("title");
              }}
              maxLength={250}
              disabled={sending}
              aria-invalid={!!errors.title}
              data-invalid={!!errors.title}
              aria-describedby={errors.title ? "pd-title-err" : undefined}
            />
            {errors.title && (
              <p className="pd__err" id="pd-title-err">
                {errors.title}
              </p>
            )}
          </div>

          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-type">
              Type <span className="pd__req">*</span>
            </label>
            <select
              id="pd-type"
              className="pd__input"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                clear("type", "typeOther");
              }}
              disabled={sending}
              aria-invalid={!!errors.type}
              data-invalid={!!errors.type}
              aria-describedby={errors.type ? "pd-type-err" : undefined}
            >
              <option value="">Choose a type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.type && (
              <p className="pd__err" id="pd-type-err">
                {errors.type}
              </p>
            )}
          </div>

          {type === OTHER && (
            <div className="pd__field">
              <label className="pd__label" htmlFor="pd-type-other">
                Please state the type <span className="pd__req">*</span>
              </label>
              <input
                id="pd-type-other"
                className="pd__input"
                value={typeOther}
                onChange={(e) => {
                  setTypeOther(e.target.value);
                  clear("typeOther");
                }}
                maxLength={100}
                disabled={sending}
                aria-invalid={!!errors.typeOther}
                data-invalid={!!errors.typeOther}
                aria-describedby={errors.typeOther ? "pd-type-other-err" : undefined}
              />
              {errors.typeOther && (
                <p className="pd__err" id="pd-type-other-err">
                  {errors.typeOther}
                </p>
              )}
            </div>
          )}

          <fieldset
            className="pd__field pd__fieldset"
            tabIndex={-1}
            data-invalid={!!errors.categories}
            aria-describedby={errors.categories ? "pd-cat-err" : undefined}
          >
            <legend className="pd__label">
              Category <span className="pd__req">*</span>{" "}
              <span className="pd__light">(tick one or more)</span>
            </legend>
            <div className="pd__checks">
              {CATEGORIES.map((c) => (
                <label key={c} className="pd__check">
                  <input
                    type="checkbox"
                    checked={categories.includes(c)}
                    onChange={() => toggleCategory(c)}
                    disabled={sending}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
            {errors.categories && (
              <p className="pd__err" id="pd-cat-err">
                {errors.categories}
              </p>
            )}
          </fieldset>

          {categories.includes(OTHER) && (
            <div className="pd__field">
              <label className="pd__label" htmlFor="pd-cat-other">
                Please state the category <span className="pd__req">*</span>
              </label>
              <input
                id="pd-cat-other"
                className="pd__input"
                value={categoryOther}
                onChange={(e) => {
                  setCategoryOther(e.target.value);
                  clear("categoryOther");
                }}
                maxLength={100}
                disabled={sending}
                aria-invalid={!!errors.categoryOther}
                data-invalid={!!errors.categoryOther}
                aria-describedby={
                  errors.categoryOther ? "pd-cat-other-err" : undefined
                }
              />
              {errors.categoryOther && (
                <p className="pd__err" id="pd-cat-other-err">
                  {errors.categoryOther}
                </p>
              )}
            </div>
          )}

          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-client">
              Proposed client organization <span className="pd__req">*</span>
            </label>
            <input
              id="pd-client"
              className="pd__input"
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                clear("client");
              }}
              maxLength={150}
              disabled={sending}
              aria-invalid={!!errors.client}
              data-invalid={!!errors.client}
              aria-describedby={errors.client ? "pd-client-err" : undefined}
            />
            {errors.client && (
              <p className="pd__err" id="pd-client-err">
                {errors.client}
              </p>
            )}
          </div>

          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-deadline">
              Submission deadline <span className="pd__req">*</span>
            </label>
            <input
              id="pd-deadline"
              className="pd__input pd__input--date"
              type="date"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                clear("deadline");
              }}
              disabled={sending || noDeadline}
              aria-invalid={!!errors.deadline}
              data-invalid={!!errors.deadline}
              aria-describedby={errors.deadline ? "pd-deadline-err" : undefined}
            />
            <label className="pd__check pd__check--inline">
              <input
                type="checkbox"
                checked={noDeadline}
                onChange={(e) => {
                  setNoDeadline(e.target.checked);
                  if (e.target.checked) setDeadline("");
                  clear("deadline");
                }}
                disabled={sending}
              />
              <span>No fixed deadline</span>
            </label>
            {errors.deadline && (
              <p className="pd__err" id="pd-deadline-err">
                {errors.deadline}
              </p>
            )}
          </div>

          <div className="pd__field">
            <label className="pd__label" htmlFor="pd-note">
              Short note <span className="pd__light">(optional)</span>
            </label>
            <textarea
              id="pd-note"
              className="pd__input pd__textarea"
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                clear("note");
              }}
              disabled={sending}
              aria-invalid={!!errors.note}
              data-invalid={!!errors.note}
              aria-describedby={errors.note ? "pd-note-err" : "pd-note-count"}
            />
            <p className="pd__hint" id="pd-note-count">
              {note.length} of {NOTE_MAX} characters
            </p>
            {errors.note && (
              <p className="pd__err" id="pd-note-err">
                {errors.note}
              </p>
            )}
          </div>

          <div className="pd__field">
            <span className="pd__label" id="pd-file-label">
              Proposal file <span className="pd__req">*</span>
            </span>
            <div
              className={
                "pd__drop" +
                (dragging ? " pd__drop--over" : "") +
                (errors.file ? " pd__drop--bad" : "")
              }
              onDragOver={(e) => {
                e.preventDefault();
                if (!sending) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {file ? (
                <div className="pd__picked">
                  <span className="pd__fname">{file.name}</span>
                  <span className="pd__fsize">{prettySize(file.size)}</span>
                  <button
                    type="button"
                    className="pd__link"
                    onClick={() => setFile(null)}
                    disabled={sending}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="pd__drop-main">
                    Drop your file here, or{" "}
                    <button
                      type="button"
                      className="pd__link"
                      onClick={() => fileInput.current?.click()}
                      disabled={sending}
                      data-invalid={!!errors.file}
                      aria-describedby={errors.file ? "pd-file-err" : undefined}
                    >
                      browse
                    </button>
                  </p>
                  <p className="pd__drop-sub">
                    One file only. If you have several, put them in one ZIP.
                    <br />
                    PDF, Word or ZIP, up to {MAX_FILE_LABEL}.
                  </p>
                </>
              )}
              <input
                ref={fileInput}
                type="file"
                className="pd__file"
                accept=".pdf,.doc,.docx,.zip"
                onChange={onPick}
                tabIndex={-1}
                aria-labelledby="pd-file-label"
              />
            </div>
            {errors.file && (
              <p className="pd__err" id="pd-file-err">
                {errors.file}
              </p>
            )}
          </div>

          {/* The trap. People never see this box; robots fill in every box
              they find. The server drops anything that arrives with it
              filled in. */}
          <div className="pd__trap" aria-hidden="true">
            <label htmlFor="pd-website">Leave this box empty</label>
            <input
              id="pd-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
            />
          </div>

          {formError && (
            <p className="pd__err pd__err--form" role="alert">
              {formError}
            </p>
          )}

          {sending && (
            <div className="pd__progress" role="status" aria-live="polite">
              <div className="pd__bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p className="pd__hint">
                {percent < 100
                  ? `Uploading… ${percent}%. Please keep this page open.`
                  : "Saving to the register… Please keep this page open."}
              </p>
            </div>
          )}

          <button type="submit" className="pd__submit" disabled={sending}>
            {sending ? "Uploading…" : "Submit proposal"}
          </button>
        </form>
      </div>
    </main>
  );
}
