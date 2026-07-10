import { Link } from "react-router";

import "./page.css";

import { routes } from "../routes";
import CallToAction from "../../components/CallToAction/component";
import GizStrip from "../../components/GizStrip/component";
import AfricaMap from "./IndexMap";

import consultImg from "../Research/assets/water-aid.png";
import researchImg from "../Research/assets/social-impact-usaid.jpg";
import trainingImg from "../Research/assets/john-hopkins.jpg";

import vcaImg from "../Research/assets/nigeria-violence-usaid.png";
import neiImg from "../Research/assets/USAID.png";
import reachImg from "../Research/assets/Mercy-corps.png";
import ecowasImg from "../Research/assets/AAH.jpg";
import mhmImg from "../Research/assets/water-aid.png";

function Index() {
  return (
    <div className="landing">
      {/* Everything above the fold: hero, GIZ strip, partner marquee.
          .landing__top is exactly one viewport tall on desktop. */}
      <div className="landing__top">
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
            <div className="hero__map">
              <AfricaMap />
              <span className="hero__chip hero__chip--1">🇳🇬 Abuja · HQ</span>
              <span className="hero__chip hero__chip--2">🌍 Footprint &amp; reach</span>
            </div>
          </div>
        </div>

        {/* GIZ-ZME promo - TEMPORARY. Remove this whole block and the import
            when applications close. */}
        <div className="landing__giz">
          <GizStrip />
        </div>
        <div className="landing__companies-banner">
          <div className="track">
            <img src="/assets/worked-with.svg" alt="clients" />
          </div>
          <div aria-hidden className="track">
            <img src="/assets/worked-with.svg" alt="clients" />
          </div>
        </div>
      </div>

      {/* ===================== OUR SERVICES (bento) ===================== */}
      <div className="landing__our-services">
        <p className="landing__heading">Our Services</p>
        <h2 className="landing__sub-heading">
          Data-driven solutions, end to end.
        </h2>
        <div className="svc-bento">
          <Link to={routes.consultancy} className="svc svc--photo svc--tall">
            <div
              className="svc__bg"
              style={{ backgroundImage: `url(${consultImg})` }}
            />
            <div className="svc__in">
              <p className="svc__eyebrow">Consultancy</p>
              <h3>Move your mission forward</h3>
              <p className="svc__copy">
                Research, M&amp;E and strategic planning that delivers measurable
                impact.
              </p>
            </div>
          </Link>

          <Link to={routes.research} className="svc svc--photo svc--wide">
            <div
              className="svc__bg"
              style={{ backgroundImage: `url(${researchImg})` }}
            />
            <div className="svc__in">
              <p className="svc__eyebrow">Research</p>
              <h3>See our proof of impact</h3>
              <p className="svc__copy">
                Major projects across M&amp;E, assessment and strategic planning.
              </p>
            </div>
          </Link>

          <div className="svc svc--stat">
            <b>7</b>
            <span>Research projects delivered</span>
          </div>

          <Link to={routes.training} className="svc svc--dark">
            <h3>Upskill your team</h3>
            <p className="svc__copy">
              Corporate training in analytics and M&amp;E capacity building.
            </p>
            <span className="svc__link">Explore training →</span>
          </Link>

          <Link to={routes.courses} className="svc svc--photo">
            <div
              className="svc__bg"
              style={{ backgroundImage: `url(${trainingImg})` }}
            />
            <div className="svc__in">
              <p className="svc__eyebrow">Training</p>
              <h3>In the room</h3>
            </div>
          </Link>
        </div>
      </div>

      {/* ===================== CAPABILITIES ===================== */}
      <section className="landing__capa">
        <p className="landing__heading">Capabilities</p>
        <h2 className="landing__sub-heading">
          From study design to the dashboard on your desk.
        </h2>
        <div className="capa__grid">
          <div className="cap">
            <h3>Monitoring &amp; Evaluation</h3>
            <p>
              Theories of change, indicator frameworks, baselines and endlines
              that survive donor scrutiny.
            </p>
            <ul>
              <li>Logframes</li>
              <li>Baseline &amp; endline</li>
              <li>Impact evaluation</li>
            </ul>
          </div>
          <div className="cap">
            <h3>Survey &amp; data collection</h3>
            <p>
              Enumerator training, digital instruments, quality assurance and
              field logistics across five countries.
            </p>
            <ul>
              <li>ODK / Kobo</li>
              <li>CAPI</li>
              <li>Field QA</li>
            </ul>
          </div>
          <div className="cap">
            <h3>Analytics &amp; dashboards</h3>
            <p>
              Turning collected data into the two or three numbers a decision
              actually turns on, updated live.
            </p>
            <ul>
              <li>Power BI</li>
              <li>Tableau</li>
              <li>Looker Studio</li>
            </ul>
          </div>
          <div className="cap">
            <h3>Data science &amp; AI</h3>
            <p>
              Forecasting, targeting and classification models, built to be
              explained to a board, not just a data team.
            </p>
            <ul>
              <li>Python</li>
              <li>Machine learning</li>
              <li>Geospatial</li>
            </ul>
          </div>
          <div className="cap">
            <h3>Research &amp; publication</h3>
            <p>
              Protocol design, ethical review, analysis and manuscript writing
              through to publication.
            </p>
            <ul>
              <li>Study design</li>
              <li>Manuscripts</li>
              <li>Peer review</li>
            </ul>
          </div>
          <div className="cap">
            <h3>Capacity building</h3>
            <p>
              Bootcamps and in-house training that leave your team able to do the
              work without us.
            </p>
            <ul>
              <li>Bootcamps</li>
              <li>In-house</li>
              <li>Mentorship</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ===================== TOOLS ===================== */}
      <div className="landing__tools">
        <span className="tools__lbl">Tools we work in</span>
        {[
          "Python",
          "R",
          "SQL",
          "Power BI",
          "Tableau",
          "Stata",
          "SPSS",
          "Kobo Toolbox",
          "QGIS",
          "Excel",
        ].map((t) => (
          <span className="tools__chip" key={t}>
            {t}
          </span>
        ))}
      </div>

      {/* ===================== SECTORS ===================== */}
      <section className="landing__sectors">
        <p className="landing__heading">Sectors</p>
        <h2 className="landing__sub-heading">Where our work lands.</h2>
        <div className="sectors__grid">
          <div className="sector">
            <span>🏥</span>
            <b>Health</b>
          </div>
          <div className="sector">
            <span>🎓</span>
            <b>Education</b>
          </div>
          <div className="sector">
            <span>🌾</span>
            <b>Agriculture</b>
          </div>
          <div className="sector">
            <span>⚖️</span>
            <b>Gender &amp; inclusion</b>
          </div>
          <div className="sector">
            <span>🚨</span>
            <b>Humanitarian</b>
          </div>
          <div className="sector">
            <span>🏛️</span>
            <b>Public sector</b>
          </div>
        </div>
      </section>

      {/* ===================== HOW WE WORK ===================== */}
      <section className="landing__method">
        <p className="landing__heading">How we work</p>
        <h2 className="landing__sub-heading">
          Evidence, not opinion. Delivered on a schedule.
        </h2>
        <div className="method__steps">
          <div className="step">
            <b>STEP 01</b>
            <h3>Scope the decision</h3>
            <p>
              We start from the decision you need to make, not the data you
              happen to have.
            </p>
          </div>
          <div className="step">
            <b>STEP 02</b>
            <h3>Design the evidence</h3>
            <p>
              Instruments, sampling and ethics, built so the findings will hold
              up under review.
            </p>
          </div>
          <div className="step">
            <b>STEP 03</b>
            <h3>Collect and analyse</h3>
            <p>
              Trained enumerators, live quality checks, and analysis you can
              reproduce.
            </p>
          </div>
          <div className="step">
            <b>STEP 04</b>
            <h3>Hand over the capability</h3>
            <p>Dashboards your team owns, and the training to keep them running.</p>
          </div>
        </div>
      </section>

      {/* ===================== SELECTED ENGAGEMENTS ===================== */}
      <section className="landing__work">
        <p className="landing__heading">Selected engagements</p>
        <h2 className="landing__sub-heading">Evidence that reached a decision.</h2>
        <p className="work__lead">
          Five of the studies we have led or contributed to since 2020. Reports,
          instruments and analysis notes are on the research page.
        </p>
        <div className="work__grid">
          <article className="case">
            <div
              className="case__ph"
              style={{ backgroundImage: `url(${vcaImg})` }}
            >
              <span className="case__tag">Conflict · USAID</span>
            </div>
            <div className="case__b">
              <p className="case__when">December 2024</p>
              <h3>USAID / Nigeria Violence and Conflict Assessment</h3>
              <p className="case__design">
                <b>Design</b> Mixed methods across 18 states and the FCT.
              </p>
              <p>
                Delivered under the PEARL Activity with Social Impact and
                Integrity Global. The assessment maps the drivers of conflict, its
                actors and its hotspots, and fed directly into USAID's next
                Country Development Cooperation Strategy.
              </p>
              <div className="case__stat">
                <div>
                  <b>900+</b>
                  <span>Survey respondents</span>
                </div>
                <div>
                  <b>64</b>
                  <span>Key informant interviews</span>
                </div>
              </div>
            </div>
          </article>

          <article className="case">
            <div
              className="case__ph"
              style={{ backgroundImage: `url(${neiImg})` }}
            >
              <span className="case__tag">Education · USAID</span>
            </div>
            <div className="case__b">
              <p className="case__when">December 2020 to January 2021</p>
              <h3>Northern Education Initiative Plus (NEI+)</h3>
              <p className="case__design">
                <b>Design</b> Instrument development, daily data management,
                thematic analysis.
              </p>
              <p>
                Reading and access for over a million children in Bauchi and
                Sokoto. We programmed the collection tool, managed the daily
                inflow across three states so no backlog formed, and analysed the
                qualitative data.
              </p>
              <div className="case__stat">
                <div>
                  <b>1m+</b>
                  <span>Children reached</span>
                </div>
                <div>
                  <b>3</b>
                  <span>States, daily analysis</span>
                </div>
              </div>
            </div>
          </article>

          <article className="case">
            <div
              className="case__ph"
              style={{ backgroundImage: `url(${reachImg})` }}
            >
              <span className="case__tag">Humanitarian · Mercy Corps</span>
            </div>
            <div className="case__b">
              <p className="case__when">March to April 2021</p>
              <h3>REACH 4, food security in Damboa, Borno</h3>
              <p className="case__design">
                <b>Design</b> Enumerator-led household survey with data quality
                assurance.
              </p>
              <p>
                Food security for conflict-affected families over a one-year
                programme. We trained and supervised the enumeration team, ran the
                quality assurance, and presented the evaluation findings to Mercy
                Corps.
              </p>
              <div className="case__stat">
                <div>
                  <b>13,500</b>
                  <span>Families in scope</span>
                </div>
                <div>
                  <b>18</b>
                  <span>Enumerators, 8 communities</span>
                </div>
              </div>
            </div>
          </article>

          <article className="case case--flag">
            <div
              className="case__ph"
              style={{ backgroundImage: `url(${ecowasImg})` }}
            >
              <span className="case__tag">Gender &amp; trade · ECOWAS</span>
            </div>
            <div className="case__b">
              <p className="case__when">Nov 2025 to May 2026</p>
              <h3>ECOWAS Gender and Trade Study, regional synthesis</h3>
              <p className="case__design">
                <b>Design</b> Five-country trader survey, KIIs, FGDs and
                border-post observation.
              </p>
              <p>
                Commissioned by the ECOWAS Centre for Gender Development with GIZ
                support, to build the evidence base for the 2026 to 2030 Gender and
                Trade Strategy under AfCFTA. Data-Lead Africa led the Nigeria, Benin
                and Guinea-Bissau fieldwork and compiled the regional report across
                all five member states.
              </p>
              <div className="case__stat">
                <div>
                  <b>1,204</b>
                  <span>Traders surveyed, 5 countries</span>
                </div>
                <div>
                  <b>22</b>
                  <span>Border posts observed</span>
                </div>
              </div>
            </div>
          </article>

          <article className="case">
            <div
              className="case__ph"
              style={{ backgroundImage: `url(${mhmImg})` }}
            >
              <span className="case__tag">Health · Business case</span>
            </div>
            <div className="case__b">
              <p className="case__when">September to October 2025</p>
              <h3>Business case for reusable menstrual products</h3>
              <p className="case__design">
                <b>Design</b> Market landscaping, stakeholder mapping, demand
                analysis.
              </p>
              <p>
                Across Bauchi, Lagos and the FCT. We examined product availability
                and the gaps shaping consumer choice, mapped the actors who could
                move adoption, and built an evidence-driven case with indicative
                adoption scenarios.
              </p>
              <div className="case__stat">
                <div>
                  <b>3</b>
                  <span>States, nationally relevant</span>
                </div>
                <div>
                  <b>4</b>
                  <span>Stakeholder tiers mapped</span>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div className="work__more">
          <Link to={routes.research} className="btn btn--white">
            See all research and publications →
          </Link>
        </div>
      </section>

      {/* ===================== LEARN ===================== */}
      <section className="landing__learn">
        <p className="landing__heading">Learn with us</p>
        <h2 className="landing__sub-heading">
          Bootcamps for the skills the market is hiring for.
        </h2>
        <p className="work__lead">
          Programmes from a first line of code to applied machine learning.
        </p>
        <div className="learn__grid">
          <Link to={routes.coursesDataAnalytics} className="course">
            <span className="course__cat">Flagship · 3 months</span>
            <h3>Data Analytics</h3>
            <p>Excel, SQL, Power BI and the storytelling that makes them count.</p>
            <span className="course__meta">Scholarship eligible →</span>
          </Link>
          <Link to={routes.coursesDataScience} className="course">
            <span className="course__cat">Advanced · 3 months</span>
            <h3>AI &amp; Machine Learning</h3>
            <p>Python, modelling and deployment, taught on real problems.</p>
            <span className="course__meta">View course →</span>
          </Link>
          <Link to={routes.coursesBusinessAnalytics} className="course">
            <span className="course__cat">Business · flexible</span>
            <h3>Business Analytics</h3>
            <p>Turn business questions into dashboards decision-makers use.</p>
            <span className="course__meta">View course →</span>
          </Link>
          <Link to={routes.coursesKids} className="course course--kids">
            <span className="course__cat">☀ Summer · Ages 8 to 17</span>
            <h3>Bootcamp for Kids</h3>
            <p>Python, AI and digital creation. No experience needed.</p>
            <span className="course__meta">See the kids programme →</span>
          </Link>
        </div>
      </section>

      {/* ===================== PARTNERS ===================== */}
      <section className="landing__partners">
        <p className="landing__heading">Who we work with</p>
        <h2 className="landing__sub-heading">
          Commissioned by the organisations doing the work.
        </h2>
        <div className="partners__grid">
          <div className="client">
            <b>USAID</b>
            <span>Conflict assessment, education, agribusiness</span>
          </div>
          <div className="client">
            <b>Mercy Corps</b>
            <span>Food security evaluation, Borno</span>
          </div>
          <div className="client">
            <b>JICA</b>
            <span>Market-oriented agricultural extension</span>
          </div>
          <div className="client">
            <b>Social Impact</b>
            <span>PEARL Activity, Nigeria</span>
          </div>
          <div className="client">
            <b>ECOWAS &amp; GIZ</b>
            <span>Regional gender and trade study</span>
          </div>
          <div className="client">
            <b>WaterAid</b>
            <span>Menstrual health business case</span>
          </div>
          <div className="client">
            <b>Action Against Hunger</b>
            <span>Accountability pilot, Borno</span>
          </div>
          <div className="client">
            <b>The World Bank</b>
            <span>Analytics and evidence</span>
          </div>
        </div>
      </section>

      {/* ===================== RESEARCH LIST ===================== */}
      <section className="landing__research">
        <p className="landing__heading">Research and publications</p>
        <h2 className="landing__sub-heading">The full record.</h2>
        <p className="work__lead">
          Every study we have contributed to, with the reports where we can share
          them.
        </p>
        <div className="research__grid">
          <Link to={routes.researchUsaidAgribusiness} className="post">
            <span className="post__meta">Dec 2021 to Feb 2022 · USAID</span>
            <h3>Agribusiness Investment Midterm Performance Evaluation</h3>
            <p>
              Quantitative and qualitative analysis of national programme
              performance, feeding the midterm course correction.
            </p>
            <span className="post__more">Read the project →</span>
          </Link>
          <Link to={routes.researchPromotionOfMarketOriented} className="post">
            <span className="post__meta">Oct to Nov 2021 · JICA</span>
            <h3>Market-oriented agricultural extension, SHEP Nigeria</h3>
            <p>
              Production, market and farmer demographic analysis in Edo State,
              linking extension systems to livelihood outcomes.
            </p>
            <span className="post__more">Read the project →</span>
          </Link>
          <Link to={routes.researchAccountabilityPilot} className="post">
            <span className="post__meta">Oct to Nov 2020 · Borno State</span>
            <h3>Accountability Pilot Survey</h3>
            <p>
              Testing voice recorders and help desks as community feedback
              channels across Dikwa, Mafa and Monguno.
            </p>
            <span className="post__more">Read the project →</span>
          </Link>
        </div>
        <div className="work__more">
          <Link to={routes.research} className="btn btn--white">
            All seven projects →
          </Link>
        </div>
      </section>

      {/* ===================== IMPACT ===================== */}
      <section className="landing__impact">
        <div className="impact__grid">
          <div>
            <p className="landing__heading">Who we are</p>
            <h2 className="landing__sub-heading">
              Built in Abuja. Working across the continent.
            </h2>
            <p className="work__lead">
              We partner with governments, development agencies and businesses to
              turn data into decisions that hold up.
            </p>
            <div className="impact__countries">
              <span className="cty">🇳🇬 Nigeria</span>
              <span className="cty">🇧🇯 Benin</span>
              <span className="cty">🇬🇼 Guinea-Bissau</span>
              <span className="cty">🇹🇬 Togo</span>
              <span className="cty">🇹🇩 Chad</span>
            </div>
          </div>
          <div className="impact__stats">
            <div className="istat">
              <b>7</b>
              <span>Research projects</span>
            </div>
            <div className="istat">
              <b>5</b>
              <span>Countries</span>
            </div>
            <div className="istat">
              <b>8+</b>
              <span>Development partners</span>
            </div>
            <div className="istat">
              <b>10</b>
              <span>Training programmes</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== TESTIMONIALS (kept) ===================== */}
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
              help improve my knowledge and capacity as well as enhance my skills
              with data analysis which will increase efficiency and effectiveness
              I need to ease my work.”
            </p>
          </div>
          <div className="testimonials-card">
            <div className="card-head">
              <p className="card-initials">SJ</p>
              <p className="card-name">Shunom Jock</p>
            </div>
            <p className="card-text">
              "Very robust data analytics programme. The teachers are patient and
              well experienced. With DLA even a English Language student can become
              a Data Analyst. "
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
              experience with the team and tutors at DataLead Africa. It is really
              a place to learn for any category of learner. Thank you DataLead
              Africa for quality knowledge and time we shared."
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
