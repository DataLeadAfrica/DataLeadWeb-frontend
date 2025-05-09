import { Link } from "react-router";
import "../css/not-found.css";
import { routes } from "../routes";
export default function NotFound() {
  return (
    <div className="not-found">
      <img src="/assets/404.svg" alt="" />
      <h2>This page is missing or you typed the wrong address</h2>
      <p>
        Return to the <Link to={routes.index}>home</Link> page
      </p>
    </div>
  );
}
