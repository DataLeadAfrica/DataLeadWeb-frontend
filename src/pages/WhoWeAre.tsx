import "../css/who-we-are.css";

export default function WhoWeAre() {
  return (
    <div className="who-we-are-page">
      <img src="/assets/who-we-are/Group.png" alt="" />
      <div className="who-we-are__hero">
        <h2>Expertise in Research, Training & Consulting</h2>
        <p>
          Data-Lead Africa is a consulting firm providing world-class data
          analytics and strategic consulting services. Data is our raw material
          and we deploy exceptional skills in statistics, research methods and
          Information technology to process data into insightful quantifiable
          results.
        </p>
      </div>
      <div className="who-we-are__mission">
        <h2>Our mission</h2>
        <p>
          At DataLead Africa, we harness the power of data to unlock
          opportunities, drive progress, and bridge the gap between insight and
          action. We provide actionable data insights, foster collaborative
          partnerships, and champion data-driven decision-making to propel
          Africa's socio-economic growth and development.
        </p>
        <p className="quote">&rdquo;</p>
      </div>
      <div className="who-we-are__vision">
        <h2>Our vision</h2>
        <p>
          Empowering a data-driven Africa, where informed decisions spark
          transformative growth, innovation, and prosperity for all.
        </p>
        <p className="quote">&rdquo;</p>
      </div>
    </div>
  );
}
