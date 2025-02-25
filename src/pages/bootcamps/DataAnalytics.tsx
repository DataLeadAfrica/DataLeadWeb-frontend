import { Link } from "react-router";
import "../../css/bootcamps/data-analytics.css";

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
      <div className="data-analytics__join"></div>
    </div>
  );
}
