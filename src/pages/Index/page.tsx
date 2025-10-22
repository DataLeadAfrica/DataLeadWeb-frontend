import { Link } from "react-router";

import "./index.css";
import Card from "./components/Card";
import CallToAction from "./components/CallToAction";
import { routes } from "./routes";

function Program({
  image_src,
  title,
  body,
}: {
  image_src: string;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <div className="program">
        <div className="program__image">
          <img src={image_src} alt="" />
        </div>
        <div className="program__body">
          <h3 className="program__title">{title}</h3>
          <p>{body}</p>
        </div>
      </div>
    </Card>
  );
}

function TestimonialCard({
  testimony,
  initials,
  name,
}: {
  testimony: string;
  initials: string;
  name: string;
}) {
  return (
    <Card extraClasses="testimonials__card">
      <div className="card__content">
        <p>{testimony}</p>
        <div className="card__person">
          <p className="person__initials">{initials}</p>
          <p className="person__name">{name}</p>
        </div>
      </div>
    </Card>
  );
}

function Index() {
  return (
    <div className="landing">
      <div className="landing__hero">
        <div className="hero__text">
          <h1>
            Turning <span>Data</span> Into Decisions
          </h1>
          <div className="text__content">
            <p>
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
                className="btn btn--transparent"
              >
                Book Consultancy
              </a>
            </div>
            <div className="hero__trained">
              <img src="/assets/index/trained.png" alt="" />
              <p>10k+ Individuals Trained</p>
            </div>
          </div>
        </div>
        <div className="hero__image">
          <Card>
            <img src="/assets/index/hero.png" alt="" />
          </Card>
          <img src="/assets/index/graph.png" alt="" className="hero__graph" />
        </div>
      </div>
      <div className="companies__banner">
        <div className="track">
          <img src="/assets/worked-with.svg" alt="clients" />
        </div>
        <div aria-hidden className="track">
          <img src="/assets/worked-with.svg" alt="clients" />
        </div>
      </div>
      <div className="offerings-section">
        <div className="offerings-section__header">
          <h2 className="offerings-section__title">Our offerings</h2>
          <h3 className="offerings-section__subtitle">
            Empowering individuals and organizations through data-driven
            solutions.
          </h3>
        </div>
        <Card>
          <div className="offerings-section__card">
            <div className="card-section">
              <img src="/assets/index/research-icon.svg" alt="" />
              <h4>Research</h4>
              <p>
                Uncover valuable insights with our rigorous research services.
                We delve deep into complex issues, analyze data, and provide
                actionable recommendations to inform strategic decision-making.
              </p>
              <Link to={routes.research} className="btn">
                Discover
              </Link>
            </div>
            <div className="card-section">
              <img src="/assets/index/consultancy-icon.svg" alt="" />
              <h4>Consultancy</h4>
              <p>
                Partner with us for expert guidance and tailored solutions. Our
                experienced consultants work closely with you to understand your
                unique challenges and develop effective strategies to achieve
                your data-driven goals.
              </p>
              <Link to={routes.consultancy} className="btn">
                Discover
              </Link>
            </div>
            <div className="card-section">
              <img src="/assets/index/training-icon.svg" alt="" />
              <h4>Training</h4>
              <p>
                Empower your team with the skills and knowledge they need to
                succeed. Our comprehensive training programs cover a wide range
                of data-related topics, equipping individuals with the expertise
                to harness the power of data effectively.
              </p>
              <Link to={routes.training} className="btn">
                Discover
              </Link>
            </div>
          </div>
        </Card>
      </div>
      <div className="programs-section">
        <div className="programs-section__title">
          <h2>Building Data Literacy and Driving Impact</h2>
          <p>
            Data-Lead Africa is committed to making a lasting impact. Our
            programs are designed to address critical development challenges in
            Africa, from improving access to education and healthcare to
            enhancing food security and promoting economic growth.
          </p>
        </div>
        <div className="programs">
          <Program
            image_src="/assets/index/data-analytics.png"
            title="Data Analytics"
            body="Data analytics services allow businesses to get their data collected, processed and presented to them in the form of actionable insights while avoiding investments in the development and administration of an analytics solution.
"
          />
          <Program
            image_src="/assets/index/research.png"
            title="Research"
            body='Research is "creative and systematic work undertaken to increase the stock of knowledge". It involves the collection, organization and analysis of information to increase understanding of a topic or issue.'
          />
          <Program
            image_src="/assets/index/training.png"
            title="Training"
            body="Increasingly, companies value data analysis as a way to stay ahead. This has lead to a huge demand for qualified data analysts. Whether you’re interested in subjects like R, Python, or Excel and SQL."
          />
          <Program
            image_src="/assets/index/data-science.png"
            title="Data science"
            body="Data analysis services allow businesses to get their data collected, processed and presented to them in the form of actionable insights while avoiding investments in the development and administration of an analytics solution.
"
          />
        </div>
      </div>
      <div className="deliver">
        <div className="deliver__head">
          <h2 className="head__title">
            Driven by Expertise, Guided by Collaboration
          </h2>
          <p className="head__text">
            We bring deep knowledge and experience to every engagement. By
            working closely with you, we ensure our approach is tailored to your
            unique needs and goals, fostering a true partnership for success.
          </p>
        </div>
        <div className="deliver__content">
          <Card extraClasses="deliver__card">
            <div className="card__content">
              <p className="card__number">1</p>
              <div className="card__text">
                <p className="card__head">
                  A Structured Path to Meaningful Results
                </p>
                <p className="card__paragraph">
                  We follow a clear and effective process, whether it's in-depth
                  investigation, skill-building programs, or strategic guidance.
                </p>
              </div>
            </div>
          </Card>
          <Card extraClasses="deliver__card">
            <div className="card__content">
              <p className="card__number">2</p>
              <div className="card__text">
                <p className="card__head">
                  Committed to Your Growth and Achievement
                </p>
                <p className="card__paragraph">
                  We are dedicated to empowering you with the insights, skills,
                  and strategies you need to thrive.
                </p>
              </div>
            </div>
          </Card>
          <Card extraClasses="deliver__card">
            <div className="card__content">
              <p className="card__number">3</p>
              <div className="card__text">
                <p className="card__head">
                  Your Goals, Our Focus: Personalized Solutions
                </p>
                <p className="card__paragraph">
                  We listen to your unique goals and create customized solutions
                  to help you achieve your desired results.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>
              Discover Training and Consultation That Delivers Real Value.
            </h2>
            <div className="btns">
              <Link to={routes.courses} className="btn btn--transparent">
                Explore Courses
              </Link>
              <a
                href="https://calendly.com/datalead-a-info/30min"
                className="btn"
              >
                Book Consultation
              </a>
            </div>
          </div>
        </CallToAction>
      </div>
      <div className="testimonials">
        <div className="testimonials__header">
          <h2 className="testimonials__title">Testimonials</h2>
          <h3 className="testimonials__subtitle">Voices of Learners</h3>
          <p className="testimonials__summary">
            The little stories of each person that has gone through Data-Lead
            Africa really counts for something more. And that is why we are
            intentional about collecting this success story.
          </p>
        </div>
        <div className="testimonials__cards">
          <TestimonialCard
            testimony="My experience with Data Lead Africa was a worthy one and it has help improve my knowledge and capacity as well as enhance my skills with data analysis which will increase efficiency and effectiveness I need to ease my work.t"
            initials="BS"
            name="Blinda Stephen"
          />
          <TestimonialCard
            testimony="Very robust data analytics programme. The teachers are patient and well experienced. With DLA even a English Language student can become a Data Analyst."
            initials="SJ"
            name="Shunom Jock"
          />
          <TestimonialCard
            testimony="I absolutely loved every moment of the time I spent at Data lead Africa. I learned so much about data analysis and for an absolute beginner, it is the right step to take into the world of data and tech. "
            initials="OJ"
            name="Oluwatomi Gisanrin"
          />
          <TestimonialCard
            testimony="Even though, I participated in the virtual classes I had a great experience with the team and tutors at DataLead Africa. It is really a place to learn for any category of learner. Thank you DataLead Africa for quality knowledge and time we shared.
"
            initials="AA"
            name="Ahmed Abidolu"
          />
        </div>
      </div>
    </div>
  );
}

export default Index;
