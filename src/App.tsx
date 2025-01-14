import { Link } from "react-router";

function Header() {
  return (
    <header className="header">
      <img
        src="/src/assets/logo-header.svg"
        alt="Data-Lead Africa"
        className="header__logo"
      />
      <nav className="header__nav">
        <Link to="" className="nav__drop-down">
          About Us <img src="/src/assets/down-arrow.svg" alt="" />
          <div className="drop-down">
            <div className="drop-down__sep"></div>
            <div className="drop-down__curve"></div>
            <ul className="drop-down__links">
              <li>
                <Link to="">Who are we</Link>
              </li>
              <li>
                <Link to="">Our Team</Link>
              </li>
            </ul>
          </div>
        </Link>
        <Link to="">Blog</Link>
        <Link to="">Research</Link>
        <Link to="" className="nav__drop-down">
          Programs
          <img src="/src/assets/down-arrow.svg" alt="" />
          <div className="drop-down">
            <div className="drop-down__sep"></div>
            <div className="drop-down__curve"></div>
            <ul className="drop-down__links">
              <li>
                <Link to=""> Business Analytics Bootcamp</Link>
              </li>
              <li>
                <Link to=""> Data Science Bootcamp</Link>
              </li>
              <li>
                <Link to=""> Data Analytics Bootcamp</Link>
              </li>
              <li>
                <Link to=""> Human Resource Analytics</Link>
              </li>
              <li>
                <Link to=""> Short Courses</Link>
              </li>
              <li>
                <Link to=""> Deaf-in-Tech</Link>
              </li>
              <li>
                <Link to=""> Python for Kids</Link>
              </li>
              <li>
                <Link to=""> Digits and Signs</Link>
              </li>
              <li>
                <Link to=""> Bioinformatics</Link>
              </li>
            </ul>
          </div>
        </Link>
      </nav>
      <button className="button">Contact Us</button>
    </header>
  );
}
function App() {
  return (
    <>
      <Header />
      // <h1>Hello world</h1>
      <footer className="footer">
        <h1>Footer</h1>
      </footer>
    </>
  );
}

export default App;
