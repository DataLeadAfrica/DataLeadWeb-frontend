import { useState } from "react";
import { Link } from "react-router";

import "./page.css";

import africa from "./assets/africa.svg";
import svcConsultancy from "./assets/svc-consultancy.jpg";
import svcResearch from "./assets/svc-research.jpg";
import svcTraining from "./assets/svc-training.jpg";

import { routes } from "../routes";
import CallToAction from "../../components/CallToAction/component";

const SERVICES = [
  {
    no: "01",
    tab: "Consultancy",
    tabDesc: "Research, M&E and strategic planning",
    img: svcConsultancy,
    title: "Ready to move your mission forward?",
    body: "Expert research, monitoring and evaluation, and strategic planning that delivers measurable impact for your organization.",
    cta: "Book Consultancy",
    href: "https://calendly.com/datalead-a-info/30min",
    external: true,
  },
  {
    no: "02",
    tab: "Research",
    tabDesc: "Proof of impact across major projects",
    img: svcResearch,
    title: "See our proof of impact",
    body: "A history of major research projects across M&E, assessment and strategic planning, from field data collection to the final report.",
    cta: "View Our Research",
    to: routes.research,
    external: false,
  },
  {
    no: "03",
    tab: "Training",
    tabDesc: "Upskill your team with tailored programmes",
    img: svcTraining,
    title: "Upskill your team. Maximize your data.",
    body: "Customized corporate training in analytics and M&E capacity building, designed to turn your staff into data-driven decision-makers.",
    cta: "Explore Corporate Training",
    to: routes.training,
    external: false,
  },
];

function Index() {
  const [svc, setSvc] = useState(0);

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
          Data-driven solutions, end to end.
        </h2>

        <div className="svc-panel">
          <div className="svc-panel__tabs" role="tablist">
            {SERVICES.map((sv, i) => (
              <button
                key={sv.no}
                className="svc-tab"
                role="tab"
                aria-selected={svc === i}
                onClick={() => setSvc(i)}
                type="button"
              >
                <span className="svc-tab__no">{sv.no}</span>
                <span className="svc-tab__text">
                  <span className="svc-tab__title">{sv.tab}</span>
                  <span className="svc-tab__desc">{sv.tabDesc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="svc-panel__stage">
            <div className="svc-panel__media">
              {SERVICES.map((sv, i) => (
                <img
                  key={sv.no}
                  src={sv.img}
                  alt=""
                  className={"svc-panel__img" + (svc === i ? " on" : "")}
                  loading="lazy"
                />
              ))}
            </div>
            <div className="svc-panel__body">
              <h3>{SERVICES[svc].title}</h3>
              <p>{SERVICES[svc].body}</p>
              {SERVICES[svc].external ? (
                <a className="svc-panel__cta" href={SERVICES[svc].href}>
                  {SERVICES[svc].cta}
                  <i className="nf nf-fa-arrow_right"></i>
                </a>
              ) : (
                <Link className="svc-panel__cta" to={SERVICES[svc].to as string}>
                  {SERVICES[svc].cta}
                  <i className="nf nf-fa-arrow_right"></i>
                </Link>
              )}
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
