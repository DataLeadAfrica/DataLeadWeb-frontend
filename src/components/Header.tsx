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
          <p className="drop-down__arrow">⌄</p>
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
    "Who are we": "",
    "Our Team": "",
  };

  const programmesLinks = {
    "Business Analytics Bootcamp": "",
    "Data Science Bootcamp": "",
    "Data Analytics Bootcamp": "",
    "Human Resource Analytics": "",
    "Short Courses": "",
    "Deaf-in-Tech": "",
    "Python for Kids": "",
    "Digits and Signs": "",
    Bioinformatics: "",
  };

  return (
    <>
      <header className="header">
        <img
          src="/src/assets/logo-header.svg"
          alt="Data-Lead Africa"
          className="header__logo"
        />
        <nav className="header__nav">
          <DropDown title="About Us" self_link="" links={aboutLinks} />
          <Link className="nav__link" to="">
            Blog
          </Link>
          <Link className="nav__link" to="">
            Research
          </Link>
          <DropDown title="Programs" self_link="" links={programmesLinks} />
        </nav>
        <button className="button">Contact Us</button>
      </header>
      <div className="header__spacer"></div>
    </>
  );
}
