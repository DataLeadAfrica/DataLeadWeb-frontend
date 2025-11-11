import { Link } from "react-router";

import "./page.css";

import africa from "./assets/africa.svg";
import card_1 from "./assets/card-1.svg";
import card_2 from "./assets/card-2.svg";
import card_3 from "./assets/card-3.svg";
import split_card_1 from "./assets/split-card-1.svg";
import split_card_2 from "./assets/split-card-2.svg";
import split_card_3 from "./assets/split-card-3.svg";

import { routes } from "../routes";
import CallToAction from "../../components/CallToAction/component";

function Index() {
  return (
    <div className="landing">
      <div className="landing__hero">
        <div className="hero__text">
          <h1>Empowering Africa's Next Generation of Data Leaders</h1>
          <div className="text__content">
            <p className="hero__desc">
              Data-Lead Africa is a research and training consulting firm
              providing services in monitoring and evaluation, data analytics,
              data science training, and strategic consulting services.
            </p>
            <div className="hero__buttons">
              <Link to={routes.courses} className="btn">
                Explore courses
              </Link>
              <a
                href="https://calendly.com/datalead-a-info/30min"
                className="btn btn--white"
                style={{ display: "flex", gap: "var(--gap-1)" }}
              >
                Book Consultancy
                <i className="nf nf-fa-arrow_right"></i>
              </a>
            </div>
            <div className="hero__trained">
              <img src="/assets/index/trained.png" alt="" />
              <p>10k+ Individuals Trained</p>
            </div>
          </div>
        </div>
        <div className="hero__image">
          <img src={africa} alt="" />
        </div>
      </div>
      <div className="landing__companies-banner">
        <div className="track">
          <img src="/assets/worked-with.svg" alt="clients" />
        </div>
        <div aria-hidden className="track">
          <img src="/assets/worked-with.svg" alt="clients" />
        </div>
      </div>
      <div className="landing__our-services">
        <p className="landing__heading">Our Services</p>
        <h2 className="landing__sub-heading">
          Empowering individuals and organizations through data-driven
          solutions.
        </h2>

        <div className="our-services__cards">
          <div className="our-services__card">
            <p className="card-title">Consultancy</p>
            <p className="card-desc">
              Providing expert advice and tailored solutions to address your
              specific challenges.
            </p>
            <div className="card-image">
              <img src={card_1} alt="" />
            </div>
          </div>
          <div className="our-services__card">
            <p className="card-title">Research</p>
            <p className="card-desc">
              We provide data-driven research and actionable insights to guide
              your strategic decisions
            </p>
            <div className="card-image">
              <img src={card_2} alt="" />
            </div>
          </div>
          <div className="our-services__card">
            <p className="card-title">Training</p>
            <p className="card-desc">
              Empower your team with the skills and knowledge needed to harness
              the power of data through our comprehensive training programs
            </p>
            <div className="card-image">
              <img src={card_3} alt="" />
            </div>
          </div>
        </div>
        <div className="our-services__split-cards">
          <div className="our-services__split-card">
            <div>
              <h2>Ready to Move Your Mission Forward?</h2>
              <p>
                Let's discuss how our expert research, M&E, and strategic
                planning can deliver measurable impact for your organization
              </p>
              <a
                href="https://calendly.com/datalead-a-info/30min"
                className="btn btn--white"
                style={{ display: "flex", gap: "var(--gap-1)" }}
              >
                Book Consultancy
                <i className="nf nf-fa-arrow_right"></i>
              </a>
            </div>
            <div>
              <img src={split_card_1} alt="" />
            </div>
          </div>
          <div className="our-services__split-card">
            <div>
              <img src={split_card_2} alt="" />
            </div>
            <div>
              <h2>See Our Proof of Impact</h2>
              <p>
                Explore our history of major research projects and discover the
                depth of expertise we bring to complex M&E, assessment, and
                strategic planning challenges
              </p>
              <Link
                to={routes.research}
                className="btn btn--white"
                style={{ display: "flex", gap: "var(--gap-1)" }}
              >
                View Our Research
                <i className="nf nf-fa-arrow_right"></i>
              </Link>
            </div>
          </div>
          <div className="our-services__split-card">
            <div>
              <h2>Upskill Your Team. Maximize Your Data</h2>
              <p>
                Explore our customized corporate training programs, including
                analytics and M&E capacity building, designed to transform your
                staff into data-driven decision-makers{" "}
              </p>
              <Link
                to={routes.training}
                className="btn btn--white"
                style={{ display: "flex", gap: "var(--gap-1)" }}
              >
                Explore Corporate Training
                <i className="nf nf-fa-arrow_right"></i>
              </Link>
            </div>
            <div>
              <img src={split_card_3} alt="" />
            </div>
          </div>
        </div>
      </div>
      <div className="landing__testimonials">
        <p className="landing__heading">Testimonials</p>
        <h2 className="landing__sub-heading">
          We are intentional about collecting success stories
        </h2>
        <div className="testimonials-cards">
          <div className="testimonials-card">
            <div className="card-head">
              <p className="card-initials">BS</p>
              <p className="card-name">Blinda Stephen</p>
            </div>
            <p className="card-text">
              “My experience with Data Lead Africa was a worthy one and it has
              help improve my knowledge and capacity as well as enhance my
              skills with data analysis which will increase efficiency and
              effectiveness I need to ease my work.”
            </p>
          </div>
          <div className="testimonials-card">
            <div className="card-head">
              <p className="card-initials">SJ</p>
              <p className="card-name">Shunom Jock</p>
            </div>
            <p className="card-text">
              "Very robust data analytics programme. The teachers are patient
              and well experienced. With DLA even a English Language student can
              become a Data Analyst. "
            </p>
          </div>
          <div className="testimonials-card">
            <div className="card-head">
              <p className="card-initials">OJ</p>
              <p className="card-name">Oluwatomi Gisanrin</p>
            </div>
            <p className="card-text">
              "I absolutely loved every moment of the time I spent at Data lead
              Africa. I learned so much about data analysis and for an absolute
              beginner, it is the right step to take into the world of data and
              tech."
            </p>
          </div>
          <div className="testimonials-card">
            <div className="card-head">
              <p className="card-initials">AA</p>
              <p className="card-name">Ahmed Abidolu</p>
            </div>
            <p className="card-text">
              "Even though, I participated in the virtual classes I had a great
              experience with the team and tutors at DataLead Africa. It is
              really a place to learn for any category of learner. Thank you
              DataLead Africa for quality knowledge and time we shared."
            </p>
          </div>
        </div>
      </div>
      <CallToAction
        heading="Discover Training and Consultation That Delivers Real Value"
        btns={[
          <Link to={routes.courses} className="btn">
            Explore courses
          </Link>,
          <a
            href="https://calendly.com/datalead-a-info/30min"
            className="btn btn--white"
            style={{ display: "flex", gap: "var(--gap-1)" }}
          >
            Book Consultancy
            <i className="nf nf-fa-arrow_right"></i>
          </a>,
        ]}
      />
    </div>
  );
}

export default Index;
