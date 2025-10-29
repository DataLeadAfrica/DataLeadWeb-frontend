import { ReactElement } from "react";

import "./component.css";

export default function CallToAction({
  heading,
  btns,
}: {
  heading: string;
  btns: Array<ReactElement>;
}) {
  return (
    <div className="call-to-action__wrapper">
      <div className="call-to-action">
        <h2>{heading}</h2>
        <div>{btns}</div>
      </div>
    </div>
  );
}
