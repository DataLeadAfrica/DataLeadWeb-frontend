import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import "../academy.css";
import "./control-room.css";
import {
  AwardIcon,
  BookIcon,
  ChartIcon,
  GridIcon,
  HomeIcon,
  KeyIcon,
  MoreIcon,
  OutIcon,
  PathIcon,
  PopIcon,
  PulseIcon,
  SearchIcon,
  SlidersIcon,
  UsersIcon,
} from "./Icons";
import CommandBar from "./CommandBar";
import { routes } from "../../routes";
import type { Role } from "../../../lib/studio";

// The control room's frame: the top bar, the rail, the phone tabs and
// the command bar. Every view renders inside it.
//
// THE RAIL IS BUILT FROM ONE LIST, and that list says which items are
// for administrators. A facilitator does not get a greyed out Learners
// link with a padlock on it: the item is not there at all. A disabled
// control tells somebody what they are missing and invites them to ask
// why, which is a conversation nobody needs to have about a page they
// were never meant to see.
//
// THE PAGE BEHIND IT REFUSES TOO. Hiding a link is a courtesy. Every
// administrator-only view checks the role again, and the database
// refuses underneath that, so the three lines of defence are a menu, a
// page and a function, and only the last one actually matters.
//
// THE COUNTS ARE COUNTED. Each badge is a number the database returned,
// passed in by the page that loaded it. None of them is typed, and none
// is worked out in here from something that might be a page behind.

export type NavCounts = {
  courses?: number;
  learners?: number;
  popups?: number;
};

type Item = {
  group: "build" | "people" | "results" | "site";
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly: boolean;
  count?: keyof NavCounts;
  hot?: boolean;
};

const ITEMS: Item[] = [
  { group: "build", to: routes.studio, label: "Overview", icon: <HomeIcon />, adminOnly: false },
  {
    group: "build",
    to: routes.studioCourses,
    label: "Courses",
    icon: <BookIcon />,
    adminOnly: false,
    count: "courses",
  },
  { group: "build", to: routes.studioPaths, label: "Learning paths", icon: <PathIcon />, adminOnly: false },
  { group: "build", to: routes.studioAreas, label: "Areas and tools", icon: <GridIcon />, adminOnly: false },
  {
    group: "people",
    to: routes.studioLearners,
    label: "Learners",
    icon: <UsersIcon />,
    adminOnly: true,
    count: "learners",
    hot: true,
  },
  { group: "people", to: routes.studioStaff, label: "Staff", icon: <KeyIcon />, adminOnly: true },
  { group: "results", to: routes.studioCerts, label: "Certificates", icon: <AwardIcon />, adminOnly: true },
  { group: "results", to: routes.studioReports, label: "Reports", icon: <ChartIcon />, adminOnly: false },
  { group: "site", to: routes.studioSettings, label: "Site settings", icon: <SlidersIcon />, adminOnly: true },
  {
    group: "site",
    to: routes.studioPopups,
    label: "Popups",
    icon: <PopIcon />,
    adminOnly: true,
    count: "popups",
  },
  { group: "site", to: routes.studioHealth, label: "Health and activity", icon: <PulseIcon />, adminOnly: true },
];

const GROUPS: { key: Item["group"]; label: string }[] = [
  { key: "build", label: "Build" },
  { key: "people", label: "People" },
  { key: "results", label: "Results" },
  { key: "site", label: "Site" },
];

/** The four that fit across the bottom of a phone, per role. */
const TABS = {
  admin: [routes.studio, routes.studioCourses, routes.studioLearners, routes.studioReports],
  facilitator: [routes.studio, routes.studioCourses, routes.studioPaths, routes.studioReports],
};

type Props = {
  role: Role;
  name: string;
  counts?: NavCounts;
  children: React.ReactNode;
};

export default function Shell({ role, name, counts = {}, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  const isAdmin = role === "admin";
  const items = useMemo(() => ITEMS.filter((i) => isAdmin || !i.adminOnly), [isAdmin]);

  // Ctrl K, or Cmd K on a Mac. The one keyboard shortcut in here, and it
  // is the one every tool of this kind uses, so it is the one somebody
  // will try without being told.
  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCmdOpen(true);
    }
    if (e.key === "Escape") setCmdOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const initials = (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const here = (to: string) =>
    to === routes.studio ? location.pathname === to : location.pathname.startsWith(to);

  const tabs = TABS[isAdmin ? "admin" : "facilitator"];

  return (
    <div className="acad">
      <div className="stu">
        <div className="stu__top">
          <Link className="stu__brand" to={routes.studio}>
            <b>Data-Lead Academy</b>
            <span>Control room</span>
          </Link>

          <button type="button" className="stu__find" onClick={() => setCmdOpen(true)}>
            <SearchIcon />
            Find a course, learner, certificate or page
            <kbd>Ctrl K</kbd>
          </button>

          <button
            type="button"
            className="stu__findsmall"
            aria-label="Find a page"
            onClick={() => setCmdOpen(true)}
          >
            <SearchIcon />
          </button>

          <div className="stu__me">
            <Link className="stu__chip" to={routes.academy}>
              <OutIcon />
              View the Academy
            </Link>
            <span className="stu__av">{initials || "DL"}</span>
            <div>
              <b>{name || "Signed in"}</b>
              <small>{isAdmin ? "Administrator" : "Facilitator"}</small>
            </div>
          </div>
        </div>

        <div className="stu__wrap">
          <nav className="stu__rail" aria-label="Control room">
            {GROUPS.map((g) => {
              const mine = items.filter((i) => i.group === g.key);
              if (!mine.length) return null;
              return (
                <div className="stu__group" key={g.key}>
                  <p>{g.label}</p>
                  {mine.map((i) => {
                    const n = i.count ? counts[i.count] : undefined;
                    return (
                      <Link
                        key={i.to}
                        className="stu__nav"
                        to={i.to}
                        aria-current={here(i.to) ? "page" : undefined}
                      >
                        {i.icon}
                        <span>{i.label}</span>
                        {n ? (
                          <span className={`stu__n${i.hot ? " is-hot" : ""}`}>{n}</span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              );
            })}

            <div className="stu__foot">
              {isAdmin ? (
                <a href={routes.staffCertificates}>
                  Certificate console
                  <OutIcon />
                </a>
              ) : null}
              <a href={routes.staffPortal}>
                Staff portal
                <OutIcon />
              </a>
              <p>The two older staff tools stay where they are.</p>
            </div>
          </nav>

          <main className="stu__main" id="main">
            {children}
          </main>
        </div>

        <nav className="stu__tabs" aria-label="Control room">
          {tabs.map((to) => {
            const item = ITEMS.find((i) => i.to === to);
            if (!item) return null;
            return (
              <Link
                key={to}
                className="stu__tab"
                to={to}
                aria-current={here(to) ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="stu__tab"
            onClick={() => setCmdOpen(true)}
          >
            <MoreIcon />
            More
          </button>
        </nav>

        {cmdOpen ? (
          <CommandBar
            items={items}
            onClose={() => setCmdOpen(false)}
            onGo={(to) => {
              setCmdOpen(false);
              navigate(to);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
