import { Link, To } from "react-router";

function Program({
  image_src,
  title,
  body,
  link,
}: {
  image_src: string;
  title: string;
  body: string;
  link: To;
}) {
  return (
    <div className="program">
      <div className="program__image">
        <img src={image_src} alt="" />
      </div>
      <div className="program__body">
        <h3 className="program__title">{title}</h3>
        <p>{body}</p>
      </div>
      <Link to={link} className="button">
        Discover
      </Link>
    </div>
  );
}

function App() {
  return (
    <>
      <div className="landing-page">
        <div className="hero">
          <div className="hero__text">
            <h1>Turning Data into decisions</h1>
            <p>
              Data-Lead Africa is a consulting firm providing world-class data
              analytics and strategic consulting services.
            </p>
            <div className="hero__buttons">
              <Link to={""} className="button button-light">
                Explore our courses
              </Link>
              <Link to={""} className="button">
                Request for consultation
              </Link>
            </div>
          </div>
          <div className="hero__image">
            <img src="" alt="" />
          </div>
        </div>
        <div className="companies__banner"></div>
        <div className="programs-section">
          <h2 className="sub-header">Our Programs</h2>
          <div className="programs">
            <Program
              image_src=""
              title="Data Analysis"
              body="Data analysis services allow businesses to get their data collected, processed and presented to them in the form of actionable insights while avoiding investments in the development and administration of an analytics solution.
"
              link={""}
            />
            <Program
              image_src=""
              title="Research"
              body='Research is "creative and systematic work undertaken to increase the stock of knowledge". It involves the collection, organization and analysis of information to increase understanding of a topic or issue.'
              link={""}
            />
            <Program
              image_src=""
              title="Training"
              body="Increasingly, companies value data analysis as a way to stay ahead. This has lead to a huge demand for qualified data analysts. Whether you’re interested in subjects like R, Python, or Excel and SQL."
              link={""}
            />
            <Program
              image_src=""
              title="Bioinformatics"
              body="Bioinformatics is the science of collecting and analysing complex biological data such as genetic codes."
              link={""}
            />
            <Program
              image_src=""
              title="Portfolio Analysis"
              body="Portfolio analysis is a quantitative method for selecting an optimal portfolio that can strike a balance between maximizing the return and minimizing the risk in various uncertain environments."
              link={""}
            />
            <Program
              image_src=""
              title="Market analysis"
              body="Every ad and commercial should be tested for effectiveness. Products should be tested and optimized. Promotions should be tested. Package designs should be tested. Brand names should be evaluated."
              link={""}
            />
            <Program
              image_src=""
              title="Data science"
              body="Data analysis services allow businesses to get their data collected, processed and presented to them in the form of actionable insights while avoiding investments in the development and administration of an analytics solution.
"
              link={""}
            />
          </div>
        </div>
        <div className="deliver">
          <h2 className="sub-header">What we deliver</h2>
          <div className="deliver__content">
            <div className="deliver__text">
              <p>
                Becoming data-driven starts with defining what really matters to
                the business and an organisation in the short and long term and
                then creating the data systems and data culture that empower
                your whole system to achieve value, faster.
              </p>
            </div>
            <div className="deliver__video">
              <video src=""></video>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
