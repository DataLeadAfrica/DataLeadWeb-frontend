import { Link } from "react-router";
import "/src/components/footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__col">
        <Link to={"/"}>
          <img
            src="assets/logo-header.svg"
            alt="Data-Lead Africa"
            className="footer__logo"
          />
        </Link>
        <div className="footer__follow">
          <h3 className="col__header">Follow us</h3>
          <div className="follow-links">
            <a href="" className="follow-link">
              <i className="nf nf-fa-instagram"></i>
            </a>
            <a href="" className="follow-link">
              <i className="nf nf-dev-linkedin"></i>
            </a>
            <a href="" className="follow-link">
              <i className="nf nf-dev-twitter"></i>
            </a>
            <a href="" className="follow-link">
              <i className="nf nf-fa-youtube"></i>
            </a>
          </div>
        </div>
      </div>
      <div className="footer__col">
        <h3 className="col__header">Company</h3>
        <Link to="/contact-us">Contact Us</Link>
        <Link to="/research">Research</Link>
        <Link to="/careers">Careers</Link>
        <Link to="/blog">Blog</Link>
      </div>
      <div className="footer__col">
        <h3 className="col__header">Products</h3>
        <Link to="">Deaf learn Academy</Link>
        <Link to="">Data lead foundation</Link>
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
    </footer>
  );
}
