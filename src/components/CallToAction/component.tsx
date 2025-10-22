import { ReactElement } from "react";

import "./call-to-action.css";

export default function CallToAction({ children }: { children: ReactElement }) {
  return (
    <div className="call-to-action">
      {children}
      <img src="/assets/call-to-action.png" />
    </div>
  );
}
