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
