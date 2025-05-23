import "../css/course.css";
import Card from "../components/Card";
import CallToAction from "../components/CallToAction";

type Modules = { [head: string]: string };
type ModulesWithTracks = { [key: string]: { [head: string]: string } };

function isModulesWithTracks(
  modules: Modules | ModulesWithTracks,
): modules is ModulesWithTracks {
  return typeof Object.values(modules)[0] === "object";
}

export default function Course({
  name,
  enrolLink,
  length,
  desc,
  highlightImg,
  modules,
  price,
  oldPrice,
  benefit,
  priceImg,
}: {
  name: string;
  enrolLink: string;
  length: string;
  desc: string;
  highlightImg: string;
  modules: Modules | ModulesWithTracks;
  price: string;
  oldPrice?: string;
  benefit?: boolean;
  priceImg: string;
}) {
  return (
    <div className="course__page">
      <div className="course__head">
        <h1>{name}</h1>
        <div className="course__overlay">
          <div>
            <p className="overlay__desc">
              Program Duration: <span>{length}</span>
            </p>
            <p className="overlay__desc">
              Location: <span> Online or onsite (Abuja)</span>
            </p>
          </div>
          <div>
            <p className="overlay__desc">
              Certification: <span>Yes</span>
            </p>
            <a href={enrolLink} className="btn">
              Enrol now
            </a>
          </div>
        </div>
      </div>
      <div className="course__about">
        <div className="about__text">
          <h2>
            About this program
            <div className="title-bar"></div>
          </h2>
          <p>{desc}</p>
        </div>
        <div>
          <Card extraClasses="about__card">
            <img src={highlightImg} alt="" />
          </Card>
        </div>
      </div>
      <div className="course__modules">
        <h2>
          Modules
          <div className="title-bar title-bar--inverse"></div>
        </h2>
        <ol>
          {isModulesWithTracks(modules)
            ? Object.entries(modules).map(([groupKey, groupValue]) => (
                <li className="module__track">
                  <h3>{groupKey + ":"}</h3>
                  <ol>
                    {Object.entries(groupValue).map(([head, value]) => (
                      <li key={head}>
                        {head}
                        {value !== "" && (
                          <ul>
                            <li>{value}</li>
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </li>
              ))
            : Object.entries(modules).map(([head, value]) => (
                <li>
                  {head}
                  {value !== "" && (
                    <ul>
                      <li>{value}</li>
                    </ul>
                  )}
                </li>
              ))}
        </ol>
      </div>
      <div className="course__join">
        <Card>
          <div className="card__content">
            <h2 className="underline-header">Who Can Join?</h2>
            <p>
              At Data-Lead Africa, we believe that everyone should have the
              opportunity to thrive in the field of {name}. Our unique
              facilitation method ensures that even if you come from a
              non-computational background, our expert instructors will guide
              you through the fundamentals. We start from scratch and make
              complex concepts relatable.
            </p>
          </div>
        </Card>
      </div>
      <div className="course__payment">
        <h2 className="underline-header">Price</h2>
        <Card extraClasses="payment__card">
          <div>
            <div className="payment__details">
              <p className="payment__price">
                {`₦${price}`}
                {oldPrice && (
                  <span className="payment__old-price">{oldPrice}</span>
                )}
              </p>
              <hr />
              {benefit && (
                <p className="payment__benefit">
                  <i className="nf nf-md-check_circle_outline"></i> Spread the
                  cost with our 3-installment plan
                </p>
              )}
            </div>
            <img className="payment__img" src={priceImg} alt="" />
          </div>
        </Card>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>Embark on Your {name} Journey</h2>
            <p>
              An Immersive and Engaging Learning Experience That Will Transform
              Your {name} Skills.
            </p>
            <a href={enrolLink} className="btn">
              Enrol now
            </a>
          </div>
        </CallToAction>
      </div>
    </div>
  );
}
