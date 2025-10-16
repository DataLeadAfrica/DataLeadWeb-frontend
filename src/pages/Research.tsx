import Card from "../components/Card";
import "../css/research.css";

export default function Research({
  imgSrc,
  title,
  projTitle,
  desc,
  report,
}: {
  imgSrc: string;
  title: string;
  projTitle: string;
  desc: string;
  report?: string;
}) {
  return (
    <div className="research">
      <div className="research__head">
        <Card extraClasses="research__card">
          <img src={imgSrc} alt="" />
        </Card>
      </div>
      <div className="research__content">
        <h1>{title}</h1>
        <p className="research__text">
          <span>Project title:</span> {projTitle}
        </p>
        <p className="research__text">
          <span>Description:</span> {desc}
        </p>
        {report && <a className="btn" href={report}>Download the report</a>}
      </div>
    </div>
  );
}
