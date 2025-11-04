import "./page.css";

import scroll_dark from "./assets/scroll-dark.svg";
import scroll_light from "./assets/scroll-light.svg";
import star from "./assets/star.svg";
import Partners from "../../components/Partners/component";

export default function WhoWeAre() {
  return (
    <div className="who-we-are">
      <div className="who-we-are__hero">
        <h1>Expertise in Research, Training & Consulting</h1>
        <p>
          Data-Lead Africa is a consulting firm providing world-class data
          analytics and strategic consulting services. Data is our raw material
          and we deploy exceptional skills in statistics, research methods and
          Information technology to process data into insightful quantifiable
          results.
        </p>
      </div>
      <img src="/assets/who-we-are/Group.png" alt="" />
      <div className="who-we-are__mission-vision">
        <div className="who-we-are__mission">
          <h2>Our mission</h2>
          <p>
            At DataLead Africa, we harness the power of data to unlock
            opportunities, drive progress, and bridge the gap between insight
            and action. We provide actionable data insights, foster
            collaborative partnerships, and champion data-driven decision-making
            to propel Africa's socio-economic growth and development.
          </p>
        </div>
        <div className="who-we-are__scroll-bars">
          <div className="who-we-are__scroll-bar">
            <img src={scroll_light} alt="" />
          </div>
          <div className="who-we-are__scroll-bar">
            <img src={scroll_dark} alt="" />
          </div>
        </div>
        <div className="who-we-are__vision">
          <h2>Our vision</h2>
          <p>
            Empowering a data-driven Africa, where informed decisions spark
            transformative growth, innovation, and prosperity for all.
          </p>
        </div>
      </div>
      <Partners />
      <div className="who-we-are__approach">
        <div className="approach__head">
          <h2>Our Approach</h2>
          <p>
            At Data-Lead Africa, our consulting philosophy is built on three
            core pillars: Rigor, Relevance, and Results. We don't just collect
            data; we craft a custom journey to transform raw information into a
            clear path for positive change across the continent
          </p>
        </div>
        <div className="approach__cards">
          <div className="approach__card">
            <div className="card__head">
              <div>
                <img src={star} alt="" />
              </div>
              <p className="card__title">Tailored Research and Relevance</p>
            </div>
            <p>
              Data is only powerful when it is relevant. We reject
              "one-size-fits-all" solutions. Our team uses local expertise to
              meticulously conduct needs assessments and stakeholder mapping
            </p>
          </div>
          <div className="approach__card">
            <div className="card__head">
              <div>
                <img src={star} alt="" />
              </div>
              <p className="card__title">
                Capacity Building for Sustained Impact
              </p>
            </div>
            <p>
              Our goal is to create lasting value, not dependency. We actively
              work with your team to build robust Monitoring and Evaluation
              (M&E) frameworks and tools.
            </p>
          </div>
          <div className="approach__card">
            <div className="card__head">
              <div>
                <img src={star} alt="" />
              </div>
              <p className="card__title">Methodological Rigor and Integrity</p>
            </div>
            <p>
              We combine advanced statistical science with deep qualitative
              research expertise. Every project, from baseline evaluations to
              complex mixed-method research designs, is grounded in transparent,
              peer-reviewed processes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
