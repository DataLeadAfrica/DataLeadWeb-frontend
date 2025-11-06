import { Link } from "react-router";

import "./page.css";

import { routes } from "../routes";
export default function NotFound() {
  return (
    <div className="not-found">
      <h1>This page is missing or you typed the wrong address</h1>
      <Link className="btn btn--white" to={routes.index}>
        Go back home
        <i className="nf nf-fa-arrow_right"></i>
      </Link>
    </div>
  );
}
