import { useRef } from "react";
import { Link, To } from "react-router";

import "./index.css";
import Card from "./components/Card";

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

function CarouselCard() {
  return (
    <Card>
      <div className="carousel__card">
        <div className="card__person">
          <img src="" alt="" />
          <p>Person name</p>
        </div>
        <p className="card__paragraph">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus nemo
          nesciunt deleniti tempore recusandae nobis placeat, accusamus rem,
          repudiandae aliquid, quis consequatur maxime facilis quod. Est
          deleniti velit expedita accusamus error illum saepe animi, eveniet
          nobis rerum, quisquam suscipit debitis laboriosam nisi vel sapiente
          praesentium, et voluptatem nulla voluptas quidem.
        </p>
      </div>
    </Card>
  );
}

function Carousel() {
  const cards = useRef(null);

  // TODO: Handle carousel
  return (
    <div className="testimonials__carousel">
      <div className="carousel__cards" ref={cards}>
        <CarouselCard />
        <CarouselCard />
        <CarouselCard />
        <CarouselCard />
      </div>
      <div className="carousel__buttons">
        <button className="btn" id="prev-btn">
          <i className="nf nf-fa-chevron_left"></i>
        </button>
        <button className="btn" id="next-btn">
          <i className="nf nf-fa-chevron_right"></i>
        </button>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <div className="landing">
        <div className="landing__hero">
          <div className="hero__text">
            <h1>TURNING DATA INTO DECISION</h1>
            <p>
              Data-Lead Africa is a consulting firm providing world-class data
              analytics and strategic consulting services.
            </p>
            <div className="hero__buttons">
              <Link to={""} className="btn">
                Explore our courses
              </Link>
              <Link to={""} className="btn btn-transparent">
                Request for consultation
              </Link>
            </div>
          </div>
          <div className="hero__image">
            <img src="" alt="" />
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
          <h2 className="offerings-section__title">Our offerings</h2>
          <h3 className="offerings-section__subtitle">
            Empowering individuals and organizations through data-driven
            solutions.
          </h3>
          <Card>
            <div className="offerings-section__card">
              <div className="card-section">
                <i className="nf nf-md-file_search" />
                <h4>Research</h4>
                <p>
                  Uncover valuable insights with our rigorous research services.
                  We delve deep into complex issues, analyze data, and provide
                  actionable recommendations to inform strategic
                  decision-making.
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
                  succeed. Our comprehensive training programs cover a wide
                  range of data-related topics, equipping individuals with the
                  expertise to harness the power of data effectively.
                </p>
                <Link to={""} className="btn">
                  Discover
                </Link>
              </div>
              <div className="card-section">
                <i className="nf nf-md-chat" />
                <h4>Consultancy</h4>
                <p>
                  Partner with us for expert guidance and tailored solutions.
                  Our experienced consultants work closely with you to
                  understand your unique challenges and develop effective
                  strategies to achieve your data-driven goals.
                </p>
                <Link to={""} className="btn">
                  Discover
                </Link>
              </div>
            </div>
          </Card>
        </div>
        <div className="programs-section">
          <h2 className="programs-section__title">
            Our Programs <div className="title-bar"></div>
          </h2>
          <h3 className="programs-section__subtitle">
            Building Data Literacy and Driving Impact
          </h3>
          <p className="programs-section__summary">
            Data-Lead Africa is committed to making a lasting impact. Our
            programs are designed to address critical development challenges in
            Africa, from improving access to education and healthcare to
            enhancing food security and promoting economic growth.
          </p>
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
            <h2 className="deliver__title">
              What we deliver
              <div className="title-bar"></div>
            </h2>
            <div className="deliver__text">
              <p>
                Becoming data-driven starts with defining what really matters to
                the business and an organisation in the short and long term and
                then creating the data systems and data culture that empower
                your whole system to achieve value, faster.
              </p>
            </div>
          </div>
          <div className="deliver__video">
            <video src=""></video>
          </div>
        </div>
        <div className="testimonials">
          <div className="testimonials__header">
            <h2 className="testimonials__title">Testimonials</h2>
            <h3 className="testimonials__subtitle">
              We are Loved By Our Learners
            </h3>
            <p className="testimonials__summary">
              The little stories of each person that has gone through Data-Lead
              Africa really counts for something more. And that is why we are
              intentional about collecting this success story.
            </p>
          </div>
          <Carousel />
        </div>
      </div>
    </>
  );
}

export default App;
