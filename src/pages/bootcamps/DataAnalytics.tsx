import "../../css/bootcamps/data-analytics.css";
import Card from "../../components/Card";
import CallToAction from "../../components/CallToAction";

function LearnMethod({
  heading,
  paragraph,
  img,
}: {
  heading: string;
  paragraph: string;
  img: string;
}) {
  return (
    <div className="learn__method">
      <div className="text">
        <h3>{heading}</h3>
        <p>{paragraph}</p>
      </div>
      <img src={img} alt="" />
    </div>
  );
}

export default function DataAnalytics() {
  return (
    <div className="data-analytics__page">
      <div className="data-analytics__head">
        <h1>Data Analytics Bootcamp</h1>
      </div>
      <div className="data-analytics__about">
        <div className="about__text">
          <h2>
            About this program
            <div className="title-bar"></div>
          </h2>
          <p>
            The Data-Lead Africa Data Analytics Bootcamp is more than a
            training, it is a launchpad for your career in to research and
            analytics. Over three months of immersive, expert-led learning,
            you’ll gain the skills to manage data end-to-end, while also
            learning how to apply analytics to real-world challenges across
            sectors and policy domains.
          </p>
        </div>
        <div>
          <Card>
            <img src="/assets/bootcamps/data-analytics/highlight.jpg" alt="" />
          </Card>
        </div>
      </div>
      <div className="data-analytics__modules">
        <h2>
          Modules
          <div className="title-bar title-bar--inverse"></div>
        </h2>
        <ol>
          <li>
            Qualitative Data Analysis
            <ul>
              <li>
                Dive into the world of qualitative data analysis using
                industry-standard software like Nvivo, Atlas.ti, and QDA Miner.
                Learn to dissect and interpret data for meaningful insights.
              </li>
            </ul>
          </li>
          <li>
            Quantitative Data Analysis
            <ul>
              <li>
                Explore the quantitative side of data with hands-on experience
                in STATA, R, and SPSS. Understand statistical methods, modeling,
                and data manipulation to make informed decisions.{" "}
              </li>
            </ul>
          </li>
          <li>
            Data Storytelling and Visualization
            <ul>
              <li>
                Discover the art of data storytelling and visualization. Learn
                how to use Power BI and Microsoft Excel to convey your data
                insights effectively to a wide audience.
              </li>
            </ul>
          </li>
          <li>
            Database Management
            <ul>
              <li>
                Gain proficiency in managing databases using SQL. Master the art
                of structuring, querying, and retrieving data from databases
                efficiently.
              </li>
            </ul>
          </li>
          <li>
            Advanced Data Collection
            <ul>
              <li>
                Elevate your data collection techniques with Kobo Toolbox, a
                powerful tool for comprehensive data collection, management, and
                complex analytics.
              </li>
            </ul>
          </li>
        </ol>
      </div>
      <div className="data-analytics__join">
        <Card>
          <div className="card__content">
            <h2 className="underline-header">Who Can Join?</h2>
            <p>
              At Data-Lead Africa, we believe that everyone should have the
              opportunity to thrive in the field of data analytics. Our unique
              facilitation method ensures that even if you come from a
              non-computational background, our expert instructors will guide
              you through the fundamentals. We start from scratch and make
              complex concepts relatable.
            </p>
          </div>
        </Card>
      </div>
      <div className="data-analytics__learn">
        <h2 className="underline-header">How will you learn?</h2>
        <div className="learn__methods">
          <LearnMethod
            heading="Onsite & Online"
            paragraph="Join and collaborate with other interns online and onsite."
            img="/assets/bootcamps/data-analytics/online.svg"
          />
          <LearnMethod
            heading="Video Content"
            paragraph="High-quality easy-to-comprehend recorded video lessons."
            img="/assets/bootcamps/data-analytics/video.svg"
          />
          <LearnMethod
            heading="Peer to peer review sessions"
            paragraph="Share knowledge with other interns and gain multidimensional perspectives of problem solving."
            img="/assets/bootcamps/data-analytics/review.svg"
          />
          <LearnMethod
            heading="Case Studies"
            paragraph="Work on real-life projects by applying what you learn to solve related business problems."
            img="/assets/bootcamps/data-analytics/case.svg"
          />
        </div>
      </div>
      <div className="data-analytics__payment">
        <h2 className="underline-header">Payment Plans</h2>
        <div className="payment__options">
          <Card extraClasses="payment__option-card">
            <div className="payment__option">
              <i className="icon nf nf-fa-user_circle"></i>
              <div className="option__plan">
                <p className="plan__name">NYSC Plan</p>
                <p className="plan__price">₦ 150,000</p>
                <p className="plan__old-price">₦ 300,000</p>
                <hr />
              </div>
              <p className="option__pitch">
                <i className="nf nf-md-check_circle_outline"></i>
                Your Tech Career Starts Here: Exclusive NYSC Rate
              </p>
              <a
                href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share"
                className="btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enrol now
              </a>
            </div>
          </Card>
          <Card extraClasses="payment__option-card">
            <div className="payment__option">
              <i className="icon nf nf-fa-trophy"></i>
              <div className="option__plan">
                <p className="plan__name">Standard Plan</p>
                <p className="plan__price">₦ 250,000</p>
                <hr />
              </div>
              <p className="option__pitch">
                <i className="nf nf-md-check_circle_outline"></i>
                Pay Once & Gain Full Access
              </p>
              <p className="option__pitch">
                <i className="nf nf-md-check_circle_outline"></i>₦ 300,000
                installment payment
              </p>
                <a
                  href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share"
                  className="btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Enrol now
                </a>
            </div>
          </Card>
        </div>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>Embark on Your Data Analytics Journey</h2>
            <p>
              An Immersive and Engaging Learning Experience That Will Transform
              Your Data Skills.
            </p>
            <a
              href="https://drive.google.com/file/d/1Y_jiAI4rH_1V47b7787TP9PiqovORyEO/view?usp=sharing"
              className="btn"
            >
              Download Brochure
            </a>
          </div>
        </CallToAction>
      </div>
    </div>
  );
}
