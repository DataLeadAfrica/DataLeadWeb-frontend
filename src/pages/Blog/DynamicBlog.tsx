import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import "./dynamic-blog.css";
import Seo from "../../components/Seo/component";
import { fetchPublishedPosts, Post } from "../../lib/supabase";

function monthLabel(dateStr: string | null): string {
  if (!dateStr) return "Undated";
  const d = new Date(dateStr);
  return d.toLocaleString("en", { month: "long", year: "numeric" });
}

function shortDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en", { month: "short", day: "numeric" });
}

export default function DynamicBlog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old" | "read">("new");

  useEffect(() => {
    let active = true;
    fetchPublishedPosts().then((data) => {
      if (active) {
        setPosts(data);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.category && set.add(p.category));
    return ["All", ...Array.from(set)];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let list = posts.filter((p) => {
      const matchesCat = cat === "All" || p.category === cat;
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        (p.excerpt || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
    if (sort === "new")
      list = [...list].sort((a, b) =>
        (b.published_at || "").localeCompare(a.published_at || ""),
      );
    if (sort === "old")
      list = [...list].sort((a, b) =>
        (a.published_at || "").localeCompare(b.published_at || ""),
      );
    if (sort === "read")
      list = [...list].sort(
        (a, b) => (a.read_minutes || 0) - (b.read_minutes || 0),
      );
    return list;
  }, [posts, cat, query, sort]);

  // group by month, preserving order
  const groups = useMemo(() => {
    const map: { label: string; items: Post[] }[] = [];
    filtered.forEach((p) => {
      const label = monthLabel(p.published_at);
      let g = map.find((m) => m.label === label);
      if (!g) {
        g = { label, items: [] };
        map.push(g);
      }
      g.items.push(p);
    });
    return map;
  }, [filtered]);

  return (
    <div className="dblog">
      <Seo
        title="Blog | Data-Lead Africa - Insights on Data, Research & Training"
        description="Expert perspectives, practical guides and the latest findings shaping data, research and technology across Africa, from the Data-Lead Africa team."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Data-Lead Africa Blog",
          url: "https://dataleadafrica.com/blog",
          publisher: {
            "@type": "Organization",
            name: "Data-Lead Africa",
            url: "https://dataleadafrica.com",
          },
        }}
      />

      <div className="dblog__wrap">
        <header className="dblog__mast">
          <div className="dblog__mast-top">
            <p className="dblog__eyebrow">Insights</p>
            <Link to="/studio" className="dblog__staff">
              Staff Login &rarr;
            </Link>
          </div>
          <h1>
            The Data-Lead Africa <em>Blog</em>
          </h1>
          <p>
            Expert perspectives, practical guides and the latest findings
            shaping data, research and technology across Africa.
          </p>
        </header>
      </div>

      <div className="dblog__controls">
        <div className="dblog__controls-in">
          <div className="dblog__search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              aria-label="Search articles"
            />
          </div>
          <div className="dblog__tabs">
            {categories.map((c) => (
              <button
                key={c}
                className={"dblog__tab" + (c === cat ? " active" : "")}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <select
            className="dblog__sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as "new" | "old" | "read")}
            aria-label="Sort articles"
          >
            <option value="new">Newest first</option>
            <option value="old">Oldest first</option>
            <option value="read">Quick reads</option>
          </select>
        </div>
      </div>

      <div className="dblog__wrap">
        {loading ? (
          <div className="dblog__empty">Loading articles...</div>
        ) : posts.length === 0 ? (
          <div className="dblog__empty">
            No articles yet. Check back soon.
          </div>
        ) : (
          <>
            <div className="dblog__count">
              {filtered.length} article{filtered.length !== 1 ? "s" : ""}
              {cat !== "All" ? " in " + cat : ""}
            </div>
            {filtered.length === 0 ? (
              <div className="dblog__empty">
                No articles match your search.
              </div>
            ) : (
              groups.map((g) => (
                <div className="dblog__group" key={g.label}>
                  <div className="dblog__month">{g.label}</div>
                  <div className="dblog__grid">
                    {g.items.map((p) => (
                      <Link
                        key={p.id}
                        to={"/blog/" + p.slug}
                        className="dblog__card"
                      >
                        <div
                          className="dblog__card-img"
                          style={
                            p.cover_url
                              ? { backgroundImage: `url(${p.cover_url})` }
                              : undefined
                          }
                        />
                        <div className="dblog__card-body">
                          <div className="dblog__card-meta">
                            {p.category && (
                              <span className="dblog__chip">{p.category}</span>
                            )}
                            <span>·</span>
                            <span>{p.read_minutes || 5} min read</span>
                          </div>
                          <h3 className="dblog__card-title">{p.title}</h3>
                          {p.excerpt && (
                            <p className="dblog__card-excerpt">{p.excerpt}</p>
                          )}
                          <div className="dblog__card-foot">
                            <span>{shortDate(p.published_at)}</span>
                            <span className="dblog__go">Read &rarr;</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
