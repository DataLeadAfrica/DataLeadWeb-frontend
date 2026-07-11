import "./page.css";

import Partners from "../../components/Partners/component";

import hero from "./assets/wwa-hero.jpg";
import audience from "./assets/wwa-audience.jpg";
import coding from "./assets/wwa-coding.jpg";
import tee from "./assets/wwa-tee.jpg";
import powerbi from "./assets/wwa-powerbi.jpg";
import handshake from "./assets/wwa-handshake.jpg";
import teaching from "./assets/wwa-teaching.jpg";
import discussion from "./assets/wwa-discussion.jpg";

export default function WhoWeAre() {
  return (
    <div className="wwa">
      {/* HERO */}
      <section className="wwa-hero">
        <div className="wwa-hero__grid">
          <div>
            <p className="wwa-eyebrow">Who we are</p>
            <h1 className="wwa-hero__title">
              Expertise in Research, Training &amp; Consulting
            </h1>
            <p className="wwa-hero__lead">
              Data-Lead Africa is a consulting firm providing world-class data
              analytics and strategic consulting services. Data is our raw
              material and we deploy exceptional skills in statistics, research
              methods and Information technology to process data into insightful
              quantifiable results.
            </p>
          </div>
          <div className="wwa-hero__photo">
            <img src={hero} alt="Data-Lead Africa team member presenting" />
            <span className="wwa-hero__badge">
              <span className="wwa-dot"></span> Unleashing African potential
            </span>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="wwa-proof">
        <div className="wwa-proof__bg">
          <img src={audience} alt="" />
        </div>
        <div className="wwa-proof__in">
          <div className="wwa-stat">
            <b>
              100<em>+</em>
            </b>
            <span>Research projects delivered</span>
          </div>
          <div className="wwa-stat">
            <b>
              52<em>+</em>
            </b>
            <span>Development partners</span>
          </div>
          <div className="wwa-stat">
            <b>12</b>
            <span>African countries</span>
          </div>
          <div className="wwa-stat">
            <b>
              1m<em>+</em>
            </b>
            <span>Lives reached through our work</span>
          </div>
        </div>
      </section>

      {/* MISSION / VISION */}
      <section className="wwa-mv">
        <div className="wwa-mv__grid">
          <div className="wwa-mv__card">
            <div className="wwa-mv__ic">&#9678;</div>
            <h2>Our mission</h2>
            <p>
              At DataLead Africa, we harness the power of data to unlock
              opportunities, drive progress, and bridge the gap between insight
              and action. We provide actionable data insights, foster
              collaborative partnerships, and champion data-driven
              decision-making to propel Africa's socio-economic growth and
              development.
            </p>
          </div>
          <div className="wwa-mv__card wwa-mv__card--dark">
            <div className="wwa-mv__ic">&#9670;</div>
            <h2>Our vision</h2>
            <p>
              Empowering a data-driven Africa, where informed decisions spark
              transformative growth, innovation, and prosperity for all.
            </p>
          </div>
        </div>
      </section>

      {/* THE TEAM IN ACTION */}
      <section className="wwa-strip">
        <div className="wwa-strip__head">
          <div>
            <p className="wwa-eyebrow">The team in action</p>
            <h2 className="wwa-strip__title">Real work, across the continent.</h2>
          </div>
          <a
            className="wwa-strip__link"
            href="https://www.flickr.com/photos/dataleadafrica/"
            target="_blank"
            rel="noopener noreferrer"
          >
            See more on our gallery &rarr;
          </a>
        </div>
        <div className="wwa-strip__grid">
          <div className="wwa-strip__item wwa-strip__item--tall">
            <img src={coding} alt="" />
            <div className="wwa-strip__cap">Turning numbers into insight</div>
          </div>
          <div className="wwa-strip__item">
            <img src={tee} alt="" />
            <div className="wwa-strip__cap">Data or it didn't happen</div>
          </div>
          <div className="wwa-strip__item">
            <img src={powerbi} alt="" />
            <div className="wwa-strip__cap">Hands-on with the tools</div>
          </div>
          <div className="wwa-strip__item wwa-strip__item--wide">
            <img src={handshake} alt="" />
            <div className="wwa-strip__cap">
              Partnering with institutions that move the country
            </div>
          </div>
          <div className="wwa-strip__item">
            <img src={teaching} alt="" />
            <div className="wwa-strip__cap">Teaching what we practice</div>
          </div>
          <div className="wwa-strip__item">
            <img src={discussion} alt="" />
            <div className="wwa-strip__cap">Ideas, exchanged in the room</div>
          </div>
        </div>
      </section>

      <Partners />

      {/* APPROACH */}
      <section className="wwa-approach">
        <div className="wwa-approach__head">
          <p className="wwa-eyebrow">How we work</p>
          <h2>Our Approach</h2>
          <p>
            At Data-Lead Africa, our consulting philosophy is built on three
            core pillars: Rigor, Relevance, and Results. We don't just collect
            data; we craft a custom journey to transform raw information into a
            clear path for positive change across the continent
          </p>
        </div>
        <div className="wwa-approach__cards">
          <div className="wwa-appc">
            <div className="wwa-appc__no">01</div>
            <h3>Tailored Research and Relevance</h3>
            <p>
              Data is only powerful when it is relevant. We reject
              "one-size-fits-all" solutions. Our team uses local expertise to
              meticulously conduct needs assessments and stakeholder mapping
            </p>
          </div>
          <div className="wwa-appc">
            <div className="wwa-appc__no">02</div>
            <h3>Capacity Building for Sustained Impact</h3>
            <p>
              Our goal is to create lasting value, not dependency. We actively
              work with your team to build robust Monitoring and Evaluation
              (M&amp;E) frameworks and tools.
            </p>
          </div>
          <div className="wwa-appc">
            <div className="wwa-appc__no">03</div>
            <h3>Methodological Rigor and Integrity</h3>
            <p>
              We combine advanced statistical science with deep qualitative
              research expertise. Every project, from baseline evaluations to
              complex mixed-method research designs, is grounded in transparent,
              peer-reviewed processes
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
