import { Link } from "react-router";

import "./component.css";
import { routes } from "../../pages/routes";

export default function Header() {
  function DropDown({
    title,
    links,
  }: {
    title: string;
    links: Record<string, string>;
  }) {
    return (
      <div className="nav__dropdown-container" tabIndex={0}>
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
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  function MobileDropDown({
    title,
    links,
  }: {
    title: string;
    links: Record<string, string>;
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
              <Link
                className="content__link"
                to={links[key]}
                onClick={handleClick}
              >
                {key}
              </Link>
            </li>
          ))}
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
          <Link className="nav__link" to={routes.courses}>
            Courses
          </Link>
          <Link className="nav__link" to={routes.blog}>
            Blog
          </Link>
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
              <Link
                className="menu__link"
                to={routes.courses}
                onClick={handleClick}
              >
                Courses
              </Link>
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
