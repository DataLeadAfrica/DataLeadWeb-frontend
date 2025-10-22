import Card from "../components/Card";
import "../css/bio.css";

export default function Bio({
  imgSrc,
  name,
  text,
}: {
  imgSrc: string;
  name: string;
  text: string;
}) {
  return (
    <div className="bio-page">
      <div className="top">
        <Card>
          <img src={imgSrc} alt={name + " image"} />
        </Card>
      </div>
      <div className="body">
        <h1 className="bio__name">{name}</h1>
        <div className="bio__text">
          {text.split("\n\n").map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
