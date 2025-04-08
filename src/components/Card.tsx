import "./card.css";

interface CardProps {
  children?: React.ReactNode;
  extraClasses?: string;
}

export default function Card({ children, extraClasses }: CardProps) {
  return (
    <div className={extraClasses ? "card " + extraClasses : "card"}>
      {children}
    </div>
  );
}
