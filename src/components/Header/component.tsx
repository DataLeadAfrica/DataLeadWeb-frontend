import { Link } from "react-router";

import "./component.css";
import { routes } from "../../pages/routes";

export default function Header() {
  function DropDown({
    title,
    links,
    group,
    allTo,
    staticLinks,
  }: {
    title: string;
    links: Record<string, string>;
    /** Optional nested flyout, e.g. Summer Bootcamp for Kids. */
    group?: { title: string; note?: string; to: string; links: Record<string, string> };
    /** Optional "All X" link, always rendered last. */
    allTo?: string;
    /**
     * True when the links point at static pages in /public (e.g. /giz).
     * Those must be plain <a href> so the browser does a real page load,
     * instead of react-router trying to match them as SPA routes.
     */
    staticLinks?: boolean;
  }) {
    return (
      <div className="nav__dropdown-container" tabIndex={0}>
        {allTo ? (
          <Link className="nav__link" to={allTo}>
            {title}
            <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
          </Link>
        ) : (
          <p className="nav__link">
            {title}
            <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
          </p>
        )}
        <div className="drop-down">
          <div className="drop-down__sep"></div>
          <div className="drop-down__top"></div>
          <ul className="drop-down__links">
            {Object.keys(links).map((key) => (
              <li className="drop-down__link" key={key}>
                {staticLinks ? (
                  <a href={links[key]}>{key}</a>
                ) : (
                  <Link to={links[key]}>{key}</Link>
                )}
              </li>
            ))}

            {group && (
              <li className="drop-down__link sub-menu" tabIndex={0}>
                <span className="sub-menu__label">
                  {group.title}
                  {group.note && <em className="sub-menu__note">{group.note}</em>}
                  <i className="sub-menu__chev">&#9656;</i>
                </span>
                <ul className="sub-menu__links">
                  {Object.keys(group.links).map((key) => (
                    <li className="drop-down__link" key={key}>
                      <Link to={group.links[key]}>{key}</Link>
                    </li>
                  ))}
                  <li className="drop-down__link drop-down__link--all">
                    <Link to={group.to}>See the kids programme &rarr;</Link>
                  </li>
                </ul>
              </li>
            )}

            {allTo && (
              <li className="drop-down__link drop-down__link--all">
                <Link to={allTo}>All courses &rarr;</Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    );
  }

  function MobileDropDown({
    title,
    links,
    group,
    allTo,
    staticLinks,
  }: {
    title: string;
    links: Record<string, string>;
    group?: { title: string; note?: string; to: string; links: Record<string, string> };
    allTo?: string;
    /** See the note on DropDown above. */
    staticLinks?: boolean;
  }) {
    return (
      <details className="menu__dropdown">
        <summary>
          <p>
            {title}
            <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
          </p>
        </summary>
        <ul className="content">
          {Object.keys(links).map((key) => (
            <li key={key}>
              {staticLinks ? (
                <a
                  className="content__link"
                  href={links[key]}
                  onClick={handleClick}
                >
                  {key}
                </a>
              ) : (
                <Link
                  className="content__link"
                  to={links[key]}
                  onClick={handleClick}
                >
                  {key}
                </Link>
              )}
            </li>
          ))}

          {group && (
            <li>
              <details className="menu__dropdown menu__dropdown--nested">
                <summary>
                  <p>
                    {group.title}
                    <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
                  </p>
                </summary>
                <ul className="content">
                  {Object.keys(group.links).map((key) => (
                    <li key={key}>
                      <Link
                        className="content__link"
                        to={group.links[key]}
                        onClick={handleClick}
                      >
                        {key}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      className="content__link"
                      to={group.to}
                      onClick={handleClick}
                    >
                      See the kids programme &rarr;
                    </Link>
                  </li>
                </ul>
              </details>
            </li>
          )}

          {allTo && (
            <li>
              <Link className="content__link" to={allTo} onClick={handleClick}>
                All courses &rarr;
              </Link>
            </li>
          )}
        </ul>
      </details>
    );
  }

  const aboutLinks: Record<string, string> = {
    "Who we are": routes.whoWeAre,
    "Our Team": routes.ourTeam,
  };

  const servicesLinks: Record<string, string> = {
    Consultancy: routes.consultancy,
    Research: routes.research,
    Training: routes.training,
  };

  // GIZ is running two programmes. Both pages are static files in /public,
  // so these are plain <a href> links (staticLinks below), not <Link to>.
  const gizLinks: Record<string, string> = {
    "Remote Work Training": "/giz",
    "Host an Intern": "/giz/host-an-intern",
  };

  const courseLinks: Record<string, string> = {
    "Data Analytics": routes.coursesDataAnalytics,
    "AI & Machine Learning": routes.coursesDataScience,
    "Business Analytics": routes.coursesBusinessAnalytics,
    Bioinformatics: routes.coursesBioInformatics,
    "HR Analytics": routes.coursesHrAnalytcis,
    "Research Methodology and Manuscript Writing":
      routes.coursesResearchMethodologies,
    "Employability & Entrepreneurship": routes.coursesEmployability,
  };

  // Nested flyout under Courses. Age range is stated once, here.
  const kidsGroup = {
    title: "Summer Bootcamp for Kids",
    note: "Ages 8 to 17",
    to: routes.coursesKids,
    links: {
      "Digital Creators": routes.coursesDigitalCreation,
      "AI & ML for Kids": routes.coursesAiMlKids,
      "Python Coding for Kids": routes.coursesPythonKids,
    } as Record<string, string>,
  };

  const handleClick = () => {
    document.getElementById("nav-menu")?.removeAttribute("open");
    const innerDropdowns = document.getElementsByClassName("menu__dropdown");
    for (let i = 0; i < innerDropdowns.length; i++) {
      innerDropdowns[i].removeAttribute("open");
    }
  };

  return (
    <>
      <header className="header">
        <Link to={"/"} onClick={handleClick}>
          <img
            src="/assets/logo-header.svg"
            alt="Data-Lead Africa"
            className="header__logo"
          />
        </Link>
        <nav className="header__nav">
          <DropDown title="About Us" links={aboutLinks} />
          <DropDown title="Services" links={servicesLinks} />
          <DropDown
            title="Courses"
            links={courseLinks}
            group={kidsGroup}
            allTo={routes.courses}
          />
          <Link className="nav__link" to={routes.blog}>
            Blog
          </Link>
          {/* GIZ-ZME programmes live in /public, so they are plain <a>, not <Link>. */}
          <DropDown title="GIZ-ZME Programme" links={gizLinks} staticLinks />
          {/* World Cup 2026 - TEMPORARY promo. Remove this <a> after the tournament. */}
          <a className="btn nav__predict" href="/world-cup-2026/index.html">
            {"⚽ Predict & Win"}
          </a>
        </nav>
        <Link to={routes.contactUs} className="btn nav__contact-us">
          Contact Us
        </Link>
        <details id="nav-menu" className="nav__menu">
          <summary>
            <i className="nf nf-oct-three_bars burger"></i>
            <i className="nf nf-fae-thin_close x"></i>
          </summary>
          <div className="menu__wrapper">
            <div className="menu__content">
              <MobileDropDown title="About us" links={aboutLinks} />
              <MobileDropDown title="Services" links={servicesLinks} />
              <Link
                className="menu__link"
                to={routes.blog}
                onClick={handleClick}
              >
                Blog
              </Link>
              <Link
                className="menu__link"
                to={routes.research}
                onClick={handleClick}
              >
                Research
              </Link>
              <MobileDropDown
                title="Courses"
                links={courseLinks}
                group={kidsGroup}
                allTo={routes.courses}
              />
              {/* GIZ-ZME programmes live in /public, so they are plain <a>, not <Link>. */}
              <MobileDropDown
                title="GIZ-ZME Programme"
                links={gizLinks}
                staticLinks
              />
              {/* World Cup 2026 - TEMPORARY promo. Remove this <a> after the tournament. */}
              <a
                className="menu__predict"
                href="/world-cup-2026/index.html"
                onClick={handleClick}
              >
                {"⚽ Predict & Win"}
              </a>
              <Link
                to={routes.contactUs}
                className="btn menu__contact-us"
                onClick={handleClick}
              >
                Contact Us
              </Link>
            </div>
          </div>
        </details>
      </header>
      <div className="header__spacer"></div>
    </>
  );
}
