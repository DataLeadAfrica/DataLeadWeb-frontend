import { Link, To } from "react-router";

import "./header.css";

export default function Header() {
  function DropDown({
    title,
    self_link,
    links,
  }: {
    title: string;
    self_link: To;
    links: Record<string, string>;
  }) {
    return (
      <div className="nav__dropdown-container">
        <Link to={self_link} className="nav__link">
          {title}
          <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
        </Link>
        <div className="drop-down">
          <div className="drop-down__sep"></div>
          <div className="drop-down__curve"></div>
          <ul className="drop-down__links">
            {Object.keys(links).map((key) => (
              <li className="drop-down__link" key={key}>
                <Link to={links[key]}>{key}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const aboutLinks = {
    "Who we are": "/who-we-are",
    "Our Team": "/our-team",
  };

  const programmesLinks = {
    "Business Analytics Bootcamp": "/business-analytics-bootcamp",
    "Data Science Bootcamp": "/data-science-bootcamp",
    "Data Analytics Bootcamp": "/data-analytics-bootcamp",
    "Human Resource Analytics": "/human-resource-analytics",
    "Short Courses": "/short-courses",
    "Deaf-in-Tech": "/deaf-in-tech",
    "Python for Kids": "/python-for-kids",
    "Digits and Signs": "/digits-and-signs",
    Bioinformatics: "/bioinformatics",
  };

  return (
    <>
      <header className="header">
        <Link to={"/"}>
          <img
            src="assets/logo-header.svg"
            alt="Data-Lead Africa"
            className="header__logo"
          />
        </Link>
        <nav className="header__nav">
          <DropDown title="About Us" self_link="/about-us" links={aboutLinks} />
          <Link className="nav__link" to="/blog">
            Blog
          </Link>
          <Link className="nav__link" to="/research">
            Research
          </Link>
          <DropDown
            title="Programs"
            self_link="/programs"
            links={programmesLinks}
          />
        </nav>
        <Link to="/contact-us" className="btn contact-us">
          Contact Us
        </Link>
        <button className="header__menu">
          <img src="assets/header/menu.svg" alt="" />
        </button>
      </header>
      <div className="header__spacer"></div>
    </>
  );
}
