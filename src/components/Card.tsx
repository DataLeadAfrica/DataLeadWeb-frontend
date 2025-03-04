import { ReactElement } from "react";
import "./card.css";

export default function Card({ children }: { children: ReactElement }) {
  return <div className="card">{children}</div>;
}
