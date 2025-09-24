import "../../css/blog-post.css";

export default function SQLForBeginners() {
  return (
    <article className="blog-post">
      <div className="blog-post__head">
        <h1 className="blog-post__title">
          SQL FOR BEGINNERS: WHY EVERY NIGERIAN GRADUATE SHOULD LEARN IT
        </h1>
        <p className="blog-post__date">Date posted: September 24th 2025</p>
      </div>
      <div className="blog-post__content">
        <img className="blog-post__image" src="/assets/blog/temp.svg" alt="" />
        <div className="blog-post__text">
          <p>
            In today’s digital economy, data is everywhere, from your bank
            transactions to the attendance records in schools, to the sales logs
            at your favorite online store. But without a way to organize, query,
            and analyze that data, it’s just noise.
          </p>
          <p>
            That’s where SQL (Structured Query Language) comes in. SQL is the
            standard language used to communicate with databases, and for anyone
            looking to build a career in data analytics, research, or tech, it’s
            a must-have skill.
          </p>
          <p>
            If you’re a Nigerian graduate wondering how to stand out in the
            crowded job market, here’s why SQL should be at the top of your
            list.
          </p>

          <p>What is SQL, in Simple Terms?</p>
          <p>
            Think of a database as a giant electronic filing cabinet. Inside are
            millions of records — customer names, sales figures, survey
            responses, exam results, hospital data, and more.
          </p>
          <p>SQL is the language that lets you:</p>
          <ul>
            <li>
              Ask questions of the database (e.g., “Show me all sales from Abuja
              in August”).
            </li>
            <li>
              Filter and sort data (e.g., “List the top 10 students by GPA”).
            </li>
            <li>
              Combine data from different sources (e.g., “Match donor
              information with donation history”).
            </li>
            <li>
              Summarize information (e.g., “What is the average salary in Lagos
              by industry?”).
            </li>
          </ul>
          <p>In short: SQL turns raw data into useful answers.</p>

          <p>Why Nigerian Graduates Need SQL</p>
          <ol>
            <li>
              Employers Expect It: From banks like GTBank to NGOs like Mercy
              Corps and international organizations like USAID, SQL is the
              common language analysts use. Employers assume graduates entering
              data roles will at least know basic queries.
            </li>
            <li>
              It’s Everywhere: Every major system — finance, health, education,
              e-commerce — relies on databases. Learning SQL means you can fit
              into any sector.
            </li>
            <li>
              It Makes You Job-Ready: While many graduates leave university with
              theory, SQL gives you practical, demonstrable skills you can show
              in an interview. Imagine being asked: “Can you pull a report of
              customers by region?” — with SQL, you can do it in minutes.
            </li>
            <li>
              It’s Beginner-Friendly: Unlike full programming languages, SQL is
              easy to read and write. A query like this is straightforward:
              <pre>
                <code>
                  {`
SELECT Name, Age
FROM Students
WHERE State = 'Kano'
ORDER BY Age DESC;

`}
                </code>
              </pre>
              Even as a beginner, you can understand it: Get student names and
              ages, only from Kano, and sort from oldest to youngest.
            </li>
            <li>
              It Opens Global Opportunities: SQL is not just Nigerian. It’s
              global. Whether you apply for a role in Lagos, London, or remote
              work for a U.S. company, SQL is recognized everywhere.
            </li>
          </ol>

          <p>Where to Start with SQL</p>
          <ul>
            <li>Learn the Basics: Tables, rows, columns, and primary keys.</li>
            <li>Write Simple Queries: SELECT, FROM, WHERE, ORDER BY.</li>
            <li>Level Up: Learn JOINs, GROUP BY, and subqueries.</li>
            <li>
              Practice with Real Data: Use open datasets (government, NGO, or
              your PPA records if you’re an NYSC member).
            </li>
          </ul>

          <p>How SQL Fits Into a Data Career</p>
          <p>SQL rarely works alone. It’s often paired with:</p>
          <ul>
            <li>Excel for quick reporting.</li>
            <li>Power BI for dashboards.</li>
            <li>R or Python for deeper analytics.</li>
          </ul>
          <p>
            That’s why most employers ask for SQL plus one or two other tools.
          </p>

          <p>Learn SQL the Right Way at Data-Lead Africa</p>
          <p>
            At Data-Lead Africa’s Applied Data Analytics Bootcamp, we teach SQL
            as part of a structured 12-week journey. You’ll move from beginner
            queries to building full reports and dashboards connected to SQL
            data.
          </p>
          <ul>
            <li> Hands-on practice with MySQL</li>
            <li> Real-world projects from Nigerian sectors</li>
            <li> Mentorship from experienced facilitators</li>
            <li> A portfolio of SQL queries you can show employers</li>
          </ul>
          <div className="blog-post__register">
            <p> Next Cohort: October 20, 2025</p>
            <p> Location: Abuja (with hybrid option)</p>
            <a href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share">
              Register here
            </a>
          </div>

          <p>Final Word</p>
          <p>
            For Nigerian graduates, the competition is tough. Degrees alone
            don’t guarantee jobs anymore — skills do. SQL is one of the most
            valuable and accessible skills you can learn, and it will give you
            an edge in every sector that uses data.
          </p>
          <p>
            Start small. Write your first query. Build your first report. And in
            just weeks, you could move from beginner to analyst, ready for
            Nigeria’s job market and beyond.
          </p>
        </div>
      </div>
    </article>
  );
}
