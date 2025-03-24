import { ReactElement } from "react";

import "./call-to-action.css";

export default function CallToAction({ children }: { children: ReactElement }) {
  return (
    <div className="call-to-action">
      <div className="circle-1"></div>
      <div className="circle-2"></div>
      <div className="circle-3"></div>
      <div className="circle-4"></div>
      {children}
    </div>
  );
}
