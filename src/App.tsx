import { useRef } from "react";
import { Link, To } from "react-router";

// TODO: Finish carousel cards in loved-by

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
      <Link to={link} className="btn">
        Discover
      </Link>
    </div>
  );
}

function CarouselCard() {
  return (
    <div className="carousel-card">
      <div className="card__person">
        <img src="" alt="" />
        <p>Person name</p>
      </div>
      <p className="card__paragraph">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Minus nemo
        nesciunt deleniti tempore recusandae nobis placeat, accusamus rem,
        repudiandae aliquid, quis consequatur maxime facilis quod. Est deleniti
        velit expedita accusamus error illum saepe animi, eveniet nobis rerum,
        quisquam suscipit debitis laboriosam nisi vel sapiente praesentium, et
        voluptatem nulla voluptas quidem.
      </p>
    </div>
  );
}

function Carousel() {
  const cards = useRef(null);

  // TODO: Handle carousel
  return (
    <div className="loved-by__carousel">
      <div className="carousel-cards" ref={cards}>
        <CarouselCard />
        <CarouselCard />
        <CarouselCard />
        <CarouselCard />
      </div>
      <div className="carousel__buttons">
        <button className="btn btn-orange" id="prev-btn">
          <i className="nf nf-fa-chevron_left"></i>
        </button>
        <button className="btn btn-orange" id="next-btn">
          <i className="nf nf-fa-chevron_right"></i>
        </button>
      </div>
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
              <Link to={""} className="btn btn-light-orange">
                Explore our courses
              </Link>
              <Link to={""} className="btn">
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
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-1.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-2.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-3.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-4.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-5.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-6.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-7.png" alt="" />
            </div>
          </div>
          <div aria-hidden className="track">
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-1.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-2.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-3.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-4.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-5.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-6.png" alt="" />
            </div>
            <div className="logo__container">
              <img src="src/assets/trusted-by-logos/logo-7.png" alt="" />
            </div>
          </div>
        </div>
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
        <div className="loved-by">
          <div className="loved-by__header">
            <h2 className="sub-header">We are Loved By Our Learners</h2>
            <p>
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
