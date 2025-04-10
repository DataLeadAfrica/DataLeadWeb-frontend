import { Link } from "react-router";
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
        <div className="data-analytics__overlay">
          <div>
            <p className="overlay__desc">
              Program Duration: <span>3 months</span>
            </p>
            <p className="overlay__desc">
              Location: <span> Online or onsite</span>
            </p>
          </div>
          <div>
            <Link to="" className="btn">
              Enroll now
            </Link>
          </div>
        </div>
      </div>
      <div className="data-analytics__about">
        <div className="about__text">
          <h2>
            About this program
            <div className="title-bar"></div>
          </h2>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Praesentium
            dolores optio necessitatibus repudiandae illum repellat quas
            architecto, itaque facilis rerum deleniti perspiciatis quos mollitia
            temporibus omnis eius ducimus corporis saepe aut iure? Ipsum magni
            quo quos vero, natus ipsa, porro ea nesciunt facere, sint nemo optio
            earum adipisci cupiditate voluptatem!
          </p>
        </div>
        <div></div>
      </div>
      <div className="data-analytics__modules">
        <h2>
          Data Analytics Modules <div className="title-bar--inverse"></div>
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
            img="assets/bootcamps/data-analytics/online.svg"
          />
          <LearnMethod
            heading="Video Content"
            paragraph="High-quality easy-to-comprehend recorded video lessons."
            img="assets/bootcamps/data-analytics/video.svg"
          />
          <LearnMethod
            heading="Peer to peer review sessions"
            paragraph="Share knowledge with other interns and gain multidimensional perspectives of problem solving."
            img="assets/bootcamps/data-analytics/review.svg"
          />
          <LearnMethod
            heading="Case Studies"
            paragraph="Work on real-life projects by applying what you learn to solve related business problems."
            img="assets/bootcamps/data-analytics/case.svg"
          />
        </div>
      </div>
      <div className="data-analytics__payment">
        <h2 className="underline-header">Payment Plans</h2>
        <div className="payment__options">
          <Card>
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
                Save 16.67% when you pay in full today.
              </p>
              <button className="btn">Enroll now</button>
            </div>
          </Card>
          <Card>
            <div className="payment__option">
              <i className="icon nf nf-fa-user_circle"></i>
              <div className="option__plan">
                <p className="plan__name">One time payment</p>
                <p className="plan__price">₦ 250,000</p>
                <p className="plan__old-price">₦ 300,000</p>
                <hr />
              </div>
              <p className="option__pitch">
                <i className="nf nf-md-check_circle_outline"></i>
                Save 16.67% when you pay in full today.
              </p>
              <button className="btn">Enroll now</button>
            </div>
          </Card>
          <Card>
            <div className="payment__option">
              <i className="icon nf nf-fa-user_circle"></i>
              <div className="option__plan">
                <p className="plan__name">Installment Payment</p>
                <p className="plan__price">₦ 300,000</p>
                <hr />
              </div>
              <p className="option__pitch">
                <i className="nf nf-md-check_circle_outline"></i>
                Save 16.67% when you pay in full today.
              </p>
              <button className="btn">Enroll now</button>
            </div>
          </Card>
        </div>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>“Embark on Your Data Analytics Journey”</h2>
            <p>
              An Immersive and Engaging Learning Experience That Will Transform
              Your Data Skills.
            </p>
            <div className="btns">
              <button className="btn btn-transparent">Download Brochure</button>
              <button className="btn">Enrol now</button>
            </div>
          </div>
        </CallToAction>
      </div>
    </div>
  );
}
