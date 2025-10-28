import { Link } from "react-router";
import "./component.css";
import { routes } from "../../pages/routes";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__col">
        <Link to={"/"}>
          <img
            src="/assets/logo-header.svg"
            alt="Data-Lead Africa"
            className="footer__logo"
          />
        </Link>
        <div className="footer__follow">
          <h3 className="col__header">Follow us</h3>
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
        <h3 className="col__header">Company</h3>
        <Link to={routes.contactUs}>Contact Us</Link>
        <Link to={routes.research}>Research</Link>
        <Link to={routes.careers}>Careers</Link>
        <Link to={routes.blog}>Blog</Link>
      </div>
      <div className="footer__col">
        <h3 className="col__header">Products</h3>
        <Link to={routes.deafInTech}>Deaf in Tech</Link>
      </div>
      <div className="footer__col">
        <h3 className="col__header">Get in touch</h3>
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
