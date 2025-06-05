import { Link } from "react-router";
import "../css/careers.css";
import { routes } from "../routes";

export default function Careers() {
  return (
    <div className="careers__page">
      <img src="/assets/star.svg" alt="" />
      <h1>Currently no open positions</h1>
      <p>
        Return to the <Link to={routes.index}>home</Link> page
      </p>
    </div>
  );
}
