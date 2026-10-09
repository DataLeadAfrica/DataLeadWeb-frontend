import { useEffect } from "react";

import { siteUrl } from "../../lib/site";

// Lightweight per-page SEO: sets the document <title>, meta description,
// canonical URL, optional JSON-LD structured data, and an optional
// robots "noindex" tag for pages that should stay out of search results.
//
// Usage:  <Seo title="…" description="…" jsonLd={{ ... }} noindex />

type SeoProps = {
  title: string;
  description?: string;
  jsonLd?: object | object[];
  noindex?: boolean;
  /**
   * The path this page's canonical should point at, when it is not
   * simply the address in the bar. Optional, and every page that does
   * not pass it behaves exactly as it always did.
   *
   * It exists because the Academy's public pages are also written by an
   * edge function before the browser gets them, and the two have to
   * agree. If the edge says the canonical is /lms/courses and this said
   * /lms/courses?tool=stata, the tag would change under a crawler that
   * does run JavaScript, which is the one thing worse than not having
   * one at all.
   */
  canonicalPath?: string;
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

export default function Seo({
  title,
  description,
  jsonLd,
  noindex,
  canonicalPath,
}: SeoProps) {
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
    // SITE_ORIGIN rather than window.location.origin. A page opened on a
    // Vercel preview address, or on whichever of the two spellings of
    // the domain the visitor typed, must still name the one real
    // address as its canonical.
    upsertCanonical(siteUrl(canonicalPath ?? window.location.pathname));

    // Keep this page out of search results when asked. Added on mount and
    // removed on unmount, so it never leaks onto other pages in the SPA.
    let robots: HTMLMetaElement | null = null;
    if (noindex) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      robots.setAttribute("content", "noindex, nofollow");
      document.head.appendChild(robots);
    }

    // Take out whatever the edge function wrote before adding ours.
    //
    // api/academy-meta.js writes the Course and BreadcrumbList blocks
    // into the HTML before the browser gets it, which is the whole
    // point: a crawler that does not run JavaScript needs them there.
    // But once React boots and adds its own, a page that HAS run the
    // JavaScript ends up with two of each, and a reader has no way to
    // know which to believe.
    //
    // The edge marks its own with data-edge="1", so they can be told
    // apart from any other structured data on the page and removed
    // without touching anything else.
    const fromEdge = document.head.querySelectorAll<HTMLScriptElement>(
      'script[type="application/ld+json"][data-edge="1"]',
    );
    fromEdge.forEach((el) => el.remove());

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      if (robots && robots.parentNode) robots.parentNode.removeChild(robots);
    };
  }, [title, description, JSON.stringify(jsonLd), noindex, canonicalPath]);

  return null;
}
