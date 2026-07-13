import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router";

import "./article.css";
import Seo from "../../components/Seo/component";
import {
  Post,
  fetchPostBySlug,
  fetchPublishedPosts,
  trackArticleEvent,
} from "../../lib/supabase";

function shortDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function Article() {
  const { slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPostBySlug(slug || "").then(async (p) => {
      if (!active) return;
      setPost(p);
      setLoading(false);
      if (p) {
        // Count one view for this article (anonymous, deduped per tab).
        trackArticleEvent(p.id, "view");
        const all = await fetchPublishedPosts();
        setRelated(
          all
            .filter((a) => a.slug !== p.slug)
            .filter((a) => !p.category || a.category === p.category)
            .slice(0, 3),
        );
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  // Count a "read" when the reader scrolls to the end of the article.
  useEffect(() => {
    if (!post) return;
    const el = endRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackArticleEvent(post.id, "read");
          obs.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [post]);

  const url =
    typeof window !== "undefined" ? window.location.href : "";

  function share(network: string) {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(post?.title || "");
    const map: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    };
    if (map[network]) window.open(map[network], "_blank", "noopener");
  }

  function copyLink() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (loading) {
    return <div className="article__loading">Loading article...</div>;
  }
  if (!post) {
    return (
      <div className="article__missing">
        <h1>Article not found</h1>
        <p>This article may have been moved or unpublished.</p>
        <Link to="/blog" className="article__back-link">
          &larr; Back to all articles
        </Link>
      </div>
    );
  }

  const titledAuthor =
    (post.author_honorific && post.author_honorific !== "None"
      ? post.author_honorific + " "
      : "") + (post.author || "Data-Lead Africa");

  const authorLd = post.author
    ? {
        "@type": "Person",
        name: post.author,
        ...(post.author_honorific && post.author_honorific !== "None"
          ? { honorificPrefix: post.author_honorific }
          : {}),
        ...(post.author_designation
          ? { jobTitle: post.author_designation }
          : {}),
        worksFor: { "@type": "Organization", name: "Data-Lead Africa" },
        ...(post.author_show_email && post.author_email
          ? { email: post.author_email }
          : {}),
        ...(post.author_show_phone && post.author_phone
          ? { telephone: post.author_phone }
          : {}),
      }
    : { "@type": "Organization", name: "Data-Lead Africa" };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || "",
    image: post.cover_url ? [post.cover_url] : undefined,
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at || post.published_at || post.created_at,
    author: authorLd,
    publisher: {
      "@type": "Organization",
      name: "Data-Lead Africa",
      logo: {
        "@type": "ImageObject",
        url: "https://dataleadafrica.com/assets/dla-logo-email.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://dataleadafrica.com/blog/" + post.slug,
    },
    keywords: (post.tags || []).join(", "),
    articleSection: post.category || undefined,
  };

  return (
    <article className="article">
      <Seo
        title={post.title + " | Data-Lead Africa"}
        description={post.excerpt || post.title}
        jsonLd={jsonLd}
      />

      <div className="article__wrap">
        <div className="article__crumb">
          <Link to="/blog">&larr; All articles</Link>
        </div>

        <header className="article__head">
          <div className="article__meta">
            {post.category && (
              <span className="article__chip">{post.category}</span>
            )}
            <span>·</span>
            <span>{post.read_minutes || 5} min read</span>
            <span>·</span>
            <span>{shortDate(post.published_at)}</span>
          </div>
          <h1>{post.title}</h1>

          <div className="article__byline">
            <div className="article__avatar" />
            <div className="article__byline-who">
              <div className="article__author">{titledAuthor}</div>
              {post.author_designation && (
                <div className="article__author-role">
                  {post.author_designation}
                </div>
              )}
              <div className="article__author-role">Data-Lead Africa</div>
              {((post.author_show_email && post.author_email) ||
                (post.author_show_phone && post.author_phone)) && (
                <div className="article__contacts">
                  {post.author_show_email && post.author_email && (
                    <a
                      className="article__contact"
                      href={"mailto:" + post.author_email}
                    >
                      {post.author_email}
                    </a>
                  )}
                  {post.author_show_phone && post.author_phone && (
                    <a
                      className="article__contact"
                      href={"tel:" + post.author_phone.replace(/\s+/g, "")}
                    >
                      {post.author_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="article__share">
              <button onClick={() => share("x")} title="Share on X">
                X
              </button>
              <button
                onClick={() => share("linkedin")}
                title="Share on LinkedIn"
              >
                in
              </button>
              <button
                onClick={() => share("whatsapp")}
                title="Share on WhatsApp"
              >
                wa
              </button>
              <button onClick={copyLink} title="Copy link">
                {copied ? "\u2713" : "link"}
              </button>
            </div>
          </div>
        </header>

        {post.cover_url && (
          <div className="article__hero">
            <img src={post.cover_url} alt={post.title} />
          </div>
        )}

        {post.excerpt && <p className="article__lead">{post.excerpt}</p>}

        <div
          className="article__body"
          dangerouslySetInnerHTML={{ __html: post.body || "" }}
        />
        <div ref={endRef} aria-hidden="true" />

        <div className="article__share-bar">
          <span>Share this article</span>
          <button onClick={() => share("x")}>X</button>
          <button onClick={() => share("linkedin")}>in</button>
          <button onClick={() => share("whatsapp")}>wa</button>
          <button onClick={() => share("facebook")}>f</button>
          <button onClick={copyLink}>{copied ? "\u2713 Copied" : "Copy link"}</button>
        </div>

        {related.length > 0 && (
          <div className="article__related">
            <h3>Keep reading</h3>
            <div className="article__related-grid">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={"/blog/" + r.slug}
                  className="article__rcard"
                >
                  <div
                    className="article__rcard-img"
                    style={
                      r.cover_url
                        ? { backgroundImage: `url(${r.cover_url})` }
                        : undefined
                    }
                  />
                  <div className="article__rcard-title">{r.title}</div>
                  <div className="article__rcard-meta">
                    {r.read_minutes || 5} min read
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
