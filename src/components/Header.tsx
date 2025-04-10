import { Link } from "react-router";

import "./header.css";

export default function Header() {
  function DropDown({
    title,
    links,
  }: {
    title: string;
    links: Record<string, string>;
  }) {
    return (
      <div className="nav__dropdown-container">
        <p className="nav__link">
          {title}
          <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
        </p>
        <div className="drop-down">
          <div className="drop-down__sep"></div>
          <div className="drop-down__top"></div>
          <ul className="drop-down__links">
            {Object.keys(links).map((key) => (
              <li className="drop-down__link" key={key}>
                <Link to={links[key]}>{key}</Link>
                <i className="nf nf-md-arrow_top_right"></i>
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

  const handleClick = () => {
    document.getElementById("nav-menu")?.removeAttribute("open");
    console.log("done");
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
          <DropDown title="About Us" links={aboutLinks} />
          <Link className="nav__link" to="/blog">
            Blog
          </Link>
          <Link className="nav__link" to="/research">
            Research
          </Link>
          <DropDown title="Programs" links={programmesLinks} />
        </nav>
        <Link to="/contact-us" className="btn nav__contact-us">
          Contact Us
        </Link>
        <details id="nav-menu" className="nav__menu">
          <summary>
            <i className="nf nf-oct-three_bars burger"></i>
            <i className="nf nf-fae-thin_close x"></i>
          </summary>
          <div className="menu__wrapper">
            <div className="menu__content">
              <details className="menu__dropdown">
                <summary>
                  <p>
                    About Us
                    <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
                  </p>
                </summary>
                <div className="dropdown__content">
                  <h2>About us</h2>
                </div>
              </details>
              <Link className="menu__link" to="/blog" onClick={handleClick}>
                Blog
              </Link>
              <Link className="menu__link" to="/research" onClick={handleClick}>
                Research
              </Link>
              <details className="menu__dropdown">
                <summary>
                  <p>
                    Programs
                    <i className="nf nf-cod-chevron_down drop-down__arrow"></i>
                  </p>
                </summary>
                <div className="dropdown__content">
                  <h2>Programs</h2>
                </div>
              </details>
              <Link
                to="/contact-us"
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
