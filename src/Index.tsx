import { Link, To } from "react-router";

import "./index.css";
import Card from "./components/Card";
import CallToAction from "./components/CallToAction";

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
    <Card>
      <div className="program">
        <div className="program__image">
          <img src={image_src} alt="" />
        </div>
        <div className="program__body">
          <h3 className="program__title">{title}</h3>
          <p>{body}</p>
        </div>
        <Link to={link} className="btn">
          Discover
        </Link>
      </div>
    </Card>
  );
}

function TestimonialCard({
  testimony,
  imgSrc,
  name,
  organisation,
}: {
  testimony: string;
  imgSrc: string;
  name: string;
  organisation: string;
}) {
  return (
    <Card>
      <div className="testimonials__card">
        <p>{testimony}</p>
        <div className="card__person">
          <img src={imgSrc} alt="" />
          <div className="person__info">
            <p>{name}</p>
            <p>{organisation}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function App() {
  return (
    <div className="landing">
      <div className="landing__hero">
        <div className="hero__text">
          <h1>
            Turning <span>Data</span> Into Decisions
          </h1>
          <div className="text__content">
            <p>
              Data-Lead Africa is a research and training consulting firm
              providing services in monitoring and evaluation, data analytics,
              data science training, and strategic consulting services.
            </p>
            <div className="hero__buttons">
              <Link to={""} className="btn">
                Explore our courses
              </Link>
              <Link to={""} className="btn btn-transparent">
                Request for consultation
              </Link>
            </div>
            <div className="hero__trained">
              <img src="assets/index/trained.png" alt="" />
              <p>5k+ Individuals Trained</p>
            </div>
          </div>
        </div>
        <div className="hero__image">
          <Card>
            <img src="assets/index/hero.png" alt="" />
          </Card>
          <img src="assets/index/graph.png" alt="" className="hero__graph" />
        </div>
      </div>
      <div className="companies__banner">
        <div className="track">
          <img src="assets/worked-with.svg" alt="clients" />
        </div>
        <div aria-hidden className="track">
          <img src="assets/worked-with.svg" alt="clients" />
        </div>
      </div>
      <div className="offerings-section">
        <div className="offerings-section__header">
          <h2 className="offerings-section__title">Our offerings</h2>
          <h3 className="offerings-section__subtitle">
            Empowering individuals and organizations through data-driven
            solutions.
          </h3>
        </div>
        <Card>
          <div className="offerings-section__card">
            <div className="card-section">
              <i className="nf nf-md-file_search" />
              <h4>Research</h4>
              <p>
                Uncover valuable insights with our rigorous research services.
                We delve deep into complex issues, analyze data, and provide
                actionable recommendations to inform strategic decision-making.
              </p>
              <Link to={""} className="btn">
                Discover
              </Link>
            </div>
            <div className="card-section">
              <i className="nf nf-cod-pie_chart" />
              <h4>Training</h4>
              <p>
                Empower your team with the skills and knowledge they need to
                succeed. Our comprehensive training programs cover a wide range
                of data-related topics, equipping individuals with the expertise
                to harness the power of data effectively.
              </p>
              <Link to={""} className="btn">
                Discover
              </Link>
            </div>
            <div className="card-section">
              <i className="nf nf-md-chat" />
              <h4>Consultancy</h4>
              <p>
                Partner with us for expert guidance and tailored solutions. Our
                experienced consultants work closely with you to understand your
                unique challenges and develop effective strategies to achieve
                your data-driven goals.
              </p>
              <Link to={""} className="btn">
                Discover
              </Link>
            </div>
          </div>
        </Card>
      </div>
      <div className="programs-section">
        <div className="programs-section__title">
          <h2>Building Data Literacy and Driving Impact</h2>
          <p>
            Data-Lead Africa is committed to making a lasting impact. Our
            programs are designed to address critical development challenges in
            Africa, from improving access to education and healthcare to
            enhancing food security and promoting economic growth.
          </p>
        </div>
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
        <div className="deliver__content">
          <h2 className="deliver__title">What we deliver</h2>
          <p className="deliver__text">
            Becoming data-driven starts with defining what really matters to the
            business and an organisation in the short and long term and then
            creating the data systems and data culture that empower your whole
            system to achieve value, faster.
          </p>
        </div>
        <div className="deliver__video">
          <video src=""></video>
        </div>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>
              Discover Training and Consultation That Delivers Real Value.
            </h2>
            <div className="btns">
              <button className="btn btn-transparent">Download Brochure</button>
              <button className="btn">Enrol now</button>
            </div>
          </div>
        </CallToAction>
      </div>
      <div className="testimonials">
        <div className="testimonials__header">
          <h2 className="testimonials__title">Testimonials</h2>
          <h3 className="testimonials__subtitle">Voices of Partnership</h3>
          <p className="testimonials__summary">
            The little stories of each person that has gone through Data-Lead
            Africa really counts for something more. And that is why we are
            intentional about collecting this success story.
          </p>
        </div>
        <div className="testimonials__cards">
          <TestimonialCard
            testimony="Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum culpa veniam vero distinctio nesciunt, enim quisquam accusamus impedit quibusdam aut magnam quidem hic praesentium repellat possimus laborum odit sed eveniet."
            imgSrc=""
            name="Person name"
            organisation="Organisation"
          />
          <TestimonialCard
            testimony="Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum culpa veniam vero distinctio nesciunt, enim quisquam accusamus impedit quibusdam aut magnam quidem hic praesentium repellat possimus laborum odit sed eveniet."
            imgSrc=""
            name="Person name"
            organisation="Organisation"
          />
        </div>
      </div>
    </div>
  );
}

export default App;
