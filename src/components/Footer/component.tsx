import { Link } from "react-router";

import { routes } from "../../pages/routes";

import "./component.css";

import logo_bw from "./assets/logo-bw.svg";

// Floating "Chat with us" button. It lives in <Footer /> (which renders on every
// page in main.tsx), so it shows site-wide.
// ⚠️ CONFIRM this is the correct WhatsApp line before merging to main.
const WHATSAPP_NUMBER = "2349166661234";
const WHATSAPP_MESSAGE = "Hello Data-Lead Africa! I'd like to know more.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE,
)}`;

export default function Footer() {
  return (
    <>
      <a
        className="wa-float"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
      >
        <svg
          className="wa-float__icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        <span className="wa-float__txt">Chat with us</span>
      </a>

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
              <a
                href="https://www.tiktok.com/@data_leadafrica"
                className="follow-link"
                aria-label="TikTok"
              >
                <svg
                  className="follow-svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M16.5 3c.3 2.1 1.6 3.6 3.6 3.8v2.4c-1.2.1-2.4-.2-3.5-.8v5.9c0 3.2-2.4 5.7-5.6 5.7-3 0-5.4-2.3-5.4-5.3 0-3.1 2.6-5.5 5.9-5.1v2.5c-.4-.1-.8-.2-1.2-.2-1.5 0-2.6 1.1-2.6 2.7 0 1.5 1.1 2.6 2.6 2.6 1.5 0 2.7-1.1 2.7-2.9V3h3z" />
                </svg>
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
            <div className="phone-list">
              <Link to="tel:+2349166661234">+234 916 666 1234</Link>,{" "}
              <Link to="tel:+2347030500741">+234 703 050 0741</Link>,{" "}
              <Link to="tel:+245957914857">+245 957 914 857</Link>,{" "}
              <Link to="tel:+447983203075">+44 7983 203075</Link>
            </div>
          </div>
        </div>
        <p className="footer__copyright">
          © 2025 Data-Lead Africa. All Rights Reserved |{" "}
          <a href={routes.privacyPolicy}>Privacy Policy</a>
        </p>
      </footer>
    </>
  );
}
