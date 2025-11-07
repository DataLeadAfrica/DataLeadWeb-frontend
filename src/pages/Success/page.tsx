import { ReactNode } from "react";

import "./page.css";

import check from "./assets/check.png";
import cheerful from "./assets/cheerful.png";

export default function Success({ children }: { children: ReactNode }) {
  return (
    <div className="success">
      <div className="success__card">
        <div className="success__header">
          <h1>Payment Succesful</h1>
          <div>
            <img src={check} alt="" />
          </div>
        </div>
        <div className="success__body">
          <div className="success__text">{children}</div>
          <img className="success__img" src={cheerful} alt="" />
        </div>
      </div>
    </div>
  );
}
