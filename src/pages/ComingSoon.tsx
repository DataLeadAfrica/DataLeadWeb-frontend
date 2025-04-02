import { Link } from "react-router";
import "../css/coming-soon.css";

export default function ComingSoon() {
  return (
    <div className="coming-soon__page">
      <img src="/assets/star.svg" alt="" />
      <h1>Coming Soon</h1>
      <p>
        This page is currently not available. For now, return to the{" "}
        <Link to="/">home</Link> page
      </p>
    </div>
  );
}
