import "./page.css";

import circle from "./assets/circle.svg";

import CallToAction from "../../components/CallToAction/component";
import Partners from "../../components/Partners/component";

export default function Consultancy({
  headTitle,
  headDesc,
  headImg,
  secondTitle,
  secondDesc,
  offeringsTitle,
  offeringsDesc,
  offeringsEntries,
  ctaHead,
}: {
  headTitle: string;
  headDesc: string;
  headImg: string;
  secondTitle: string;
  secondDesc: string;
  offeringsTitle: string;
  offeringsDesc: string;
  offeringsEntries: Array<string>;
  ctaHead: string;
}) {
  return (
    <div className="consultancy__page">
      <div className="consultancy__head">
        <div>
          <h1>{headTitle}</h1>
          <p>{headDesc}</p>
        </div>
        <img src={headImg} alt="" />
      </div>
      <div className="consultancy__second">
        <div>
          <h2>{secondTitle}</h2>
          <p>{secondDesc}</p>
        </div>
        <a href="https://calendly.com/datalead-a-info/30min" className="btn">
          Book Consultation
        </a>
      </div>
      <Partners />
      <div className="consultancy__offerings">
        <h2>Our Solutions</h2>
        <div className="offerings__head">
          <p className="offerings__title">{offeringsTitle}</p>
          <p className="offerings__desc">{offeringsDesc}</p>
        </div>
        <div className="offerings__infos">
          {offeringsEntries.map((entry) => {
            return (
              <div className="offerings__info">
                <div className="info__sep">
                  <img className="info__circle" src={circle} alt="" />
                </div>
                <div className="info__content">
                  <p className="info__title">{entry}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <CallToAction
        heading={ctaHead}
        btns={[
          <a href="https://calendly.com/datalead-a-info/30min" className="btn">
            Book Consultation
          </a>,
        ]}
      />
    </div>
  );
}
