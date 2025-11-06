import "./page.css";

export default function Consultancy({
  firstTitle,
  firstDesc,
  firstImg,
  secondTitle,
  secondDesc,
  thirdTitle,
  thirdDesc,
  thirdEntries,
  fifthTitle,
}: {
  firstTitle: string;
  firstDesc: string;
  firstImg: string;
  secondTitle: string;
  secondDesc: string;
  thirdTitle: string;
  thirdDesc: string;
  thirdEntries: Array<string>;
  fifthTitle: string;
}) {
  return (
    <div className="consultancy__page">
      <div className="consultancy__first">
        <div>
          <h1>{firstTitle}</h1>
          <p>{firstDesc}</p>
        </div>
        <img src={firstImg} alt="" />
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
      <div className="consultancy__third">
        <div>
          <h2>{thirdTitle}</h2>
          <p>{thirdDesc}</p>
        </div>
        <ol>
          {thirdEntries.map((entry) => {
            return (
              <li>
                <img src="/assets/consultancy/check.svg" />
                <p>{entry}</p>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="consultancy__fourth">
        <h2>Partners in change</h2>
        <div className="consultancy__partners">
          <img id="wbnk" src="/assets/consultancy/world-bank.png" alt="" />
          <img id="usaid" src="/assets/consultancy/usaid.png" alt="" />
          <img id="mcart" src="/assets/consultancy/macarthur.png" alt="" />
          <img id="giz" src="/assets/consultancy/giz.png" alt="" />
          <img
            id="stc"
            src="/assets/consultancy/save-the-children.png"
            alt=""
          />
          <img id="caid" src="/assets/consultancy/christian-aid.png" alt="" />
          <img id="r4d" src="/assets/consultancy/r4d.png" alt="" />
          <img id="jhp" src="/assets/consultancy/jhpiego.png" alt="" />
        </div>
      </div>
      <div className="consultancy__fifth">
        <h2>{fifthTitle}</h2>
        <div>
          <p>For consultancy inquiries, contact us at:</p>
          <a href="mailto:programs@dataleadafrica.com">
            programs@dataleadafrica.com
          </a>
        </div>
        <a href="https://calendly.com/datalead-a-info/30min" className="btn">
          Book Consultation
        </a>
      </div>
    </div>
  );
}
