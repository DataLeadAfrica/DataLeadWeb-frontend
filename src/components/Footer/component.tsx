import { Link } from "react-router";

import { routes } from "../../pages/routes";

import "./component.css";

import logo_bw from "./assets/logo-bw.svg";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__col">
        <Link to={"/"}>
          <img src={logo_bw} alt="Data-Lead Africa" className="footer__logo" />
        </Link>
        <div className="footer__follow">
          <div className="follow-links">
            <a
              href="https://www.instagram.com/datalead_africa/?hl=en"
              className="follow-link"
            >
              <i className="nf nf-fa-instagram"></i>
            </a>
            <a
              href="https://ng.linkedin.com/company/data-leadafrica"
              className="follow-link"
            >
              <i className="nf nf-dev-linkedin"></i>
            </a>
            <a
              href="https://x.com/datalead_africa?lang=en"
              className="follow-link"
            >
              <i className="nf nf-dev-twitter"></i>
            </a>
            <a
              href="https://www.youtube.com/@data-leadafrica3321"
              className="follow-link"
            >
              <i className="nf nf-fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
      <div className="footer__col">
        <p className="col__header">Company</p>
        <Link to={routes.whoWeAre}>About</Link>
        <Link to={routes.training}>Training</Link>
        <Link to={routes.research}>Research</Link>
        <Link to={routes.consultancy}>Consultancy</Link>
      </div>
      <div className="footer__col">
        <p className="col__header">Get in touch</p>
        <div className="get-in-touch">
          <i className="nf nf-oct-location"></i>
          <address>
            Plot 759, Bassan Plaza, Central Business District, Abuja.
          </address>
        </div>
        <div className="get-in-touch">
          <i className="nf nf-oct-mail"></i>
          <Link to="mailto:info@dataleadafrica.com">
            info@dataleadafrica.com
          </Link>
        </div>
        <div className="get-in-touch">
          <i className="nf nf-fa-phone"></i>
          <Link to="tel:+2347030500741">+234-703-0500-741</Link>
        </div>
      </div>
      <p className="footer__copyright">
        © 2025 Data-Lead Africa. All Rights Reserved |{" "}
        <a href={routes.privacyPolicy}>Privacy Policy</a>
      </p>
    </footer>
  );
}
