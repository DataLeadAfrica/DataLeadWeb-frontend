import { useEffect } from "react";

// Lightweight per-page SEO: sets the document <title>, meta description,
// canonical URL and optional JSON-LD structured data. No external library.
//
// Usage:  <Seo title="…" description="…" jsonLd={{ ... }} />

type SeoProps = {
  title: string;
  description?: string;
  jsonLd?: object | object[];
};

function upsertMeta(name: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[name="${name}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

export default function Seo({ title, description, jsonLd }: SeoProps) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      upsertMeta("description", description);
      // keep the social preview description in sync
      let og = document.head.querySelector<HTMLMetaElement>(
        'meta[property="og:description"]',
      );
      if (!og) {
        og = document.createElement("meta");
        og.setAttribute("property", "og:description");
        document.head.appendChild(og);
      }
      og.setAttribute("content", description);
    }
    upsertCanonical(window.location.origin + window.location.pathname);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [title, description, JSON.stringify(jsonLd)]);

  return null;
}
