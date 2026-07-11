import { createClient } from "@supabase/supabase-js";

// Public Supabase connection for the Data-Lead Africa blog.
// The publishable key is safe to expose in the browser: Row Level Security
// on the database restricts the public to reading only published posts.
const SUPABASE_URL = "https://ssxqlpaioozqopelssqd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4vfhEx1z6v6rujPsnfxBNg_K9zLu8sH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  category: string | null;
  tags: string[] | null;
  author: string | null;
  read_minutes: number | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  status: string;
  author_email: string | null;
  review_note: string | null;
  updated_at: string | null;
};

// Fetch all published posts, newest first.
export async function fetchPublishedPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false });
  if (error) {
    console.error("Failed to load posts:", error.message);
    return [];
  }
  return (data as Post[]) || [];
}

// Fetch a single published post by its slug.
export async function fetchPostBySlug(slug: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) {
    console.error("Failed to load post:", error.message);
    return null;
  }
  return (data as Post) || null;
}

// ---- Studio (authenticated) helpers ----

// Upload an image to the blog-images bucket and return its public URL.
export async function uploadImage(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("blog-images")
    .upload(name, file, { cacheControl: "3600", upsert: false });
  if (error) {
    console.error("Image upload failed:", error.message);
    return null;
  }
  const { data } = supabase.storage.from("blog-images").getPublicUrl(name);
  return data.publicUrl;
}

// Rough read-time estimate from HTML body (200 words/min).
export function estimateReadMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export type DraftInput = {
  id?: string;
  title: string;
  excerpt: string;
  body: string; // HTML from the editor
  cover_url: string | null;
  category: string;
  tags: string[];
  read_minutes: number;
  authorEmail: string;
  authorName: string;
};

// Save as draft or submit for review. status: 'draft' | 'pending'
export async function savePost(
  input: DraftInput,
  status: "draft" | "pending",
): Promise<{ ok: boolean; message: string; id?: string }> {
  const base = {
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body: input.body,
    cover_url: input.cover_url,
    category: input.category.trim() || null,
    tags: input.tags,
    read_minutes: input.read_minutes,
    author: input.authorName || input.authorEmail,
    author_email: input.authorEmail,
    status,
    updated_at: new Date().toISOString(),
  };

  if (input.id) {
    const { error } = await supabase
      .from("posts")
      .update(base)
      .eq("id", input.id);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: "Saved.", id: input.id };
  }

  const slug = slugify(input.title) || "post-" + Date.now();
  const { data, error } = await supabase
    .from("posts")
    .insert({ ...base, slug, published: false })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Saved.", id: data?.id };
}

// ---- Admin queue helpers ----

// Posts an admin can act on: everything not-yet-public plus live ones.
export async function fetchAdminPosts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Failed to load admin posts:", error.message);
    return [];
  }
  return (data as Post[]) || [];
}

// Approve a pending post -> publish it live.
export async function approvePost(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("posts")
    .update({
      status: "published",
      published: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Published." };
}

// Send a post back to the author with a note.
export async function rejectPost(
  id: string,
  note: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("posts")
    .update({
      status: "rejected",
      published: false,
      review_note: note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Sent back." };
}

// Unpublish a live post (back to draft, removed from public view).
export async function unpublishPost(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase
    .from("posts")
    .update({ status: "draft", published: false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Unpublished." };
}
