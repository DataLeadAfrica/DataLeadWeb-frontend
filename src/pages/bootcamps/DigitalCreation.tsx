import CallToAction from "../../components/CallToAction";
import Card from "../../components/Card";
import "../../css/course.css";

export default function DigitalCreation() {
  return (
    <div className="course__page">
      <div className="course__head">
        <h1>Summer BOOTCAMP for Kids: Digital Creators Bootcamp</h1>
        <div className="course__overlay">
          <div>
            <p className="overlay__desc">
              Program Duration: <span>4 weeks</span>
            </p>
            <p className="overlay__desc">
              Location: <span>Onsite (Abuja)</span>
            </p>
          </div>
          <div>
            <p className="overlay__desc">
              Certification: <span>Yes</span>
            </p>
            <a
              href="https://dataleadafrica.us12.list-manage.com/subscribe?u=c6fa2b9b8050a49c42f4b6543&id=e483f81efd"
              className="btn"
            >
              Enrol now
            </a>
          </div>
        </div>
      </div>
      <div className="course__about">
        <div className="about__text">
          <h2>
            About this program
            <div className="title-bar"></div>
          </h2>
          <p>
            Give your child a fun and productive summer! This exciting hands-on
            summer bootcamp is designed for kids and teens (ages 12–17) who want
            to explore the world of digital content creation. From vlogging and
            photography to social media storytelling, they will learn how to
            plan, film, edit, and share amazing content using popular tools and
            apps. It’s the perfect blend of creativity, tech skills, and summer
            fun, setting them up to be confident, future ready creators!
          </p>
        </div>
        <div>
          <Card extraClasses="about__card">
            <img src="/assets/course/digital-creation.png" alt="" />
          </Card>
        </div>
      </div>
      <div className="course__modules">
        <h2>
          Modules
          <div className="title-bar title-bar--inverse"></div>
        </h2>
        <ol>
          <li>INTRODUCTION TO DIGITAL PLATFORMS MOBILE PHOTOGRAPHY BASICS</li>
          <li>
            INTRODUCTION TO PHOTOSHOP GRAPHIC DESIGN BASICS PERSONAL BRANDING
          </li>
          <li>BASICS SOCIAL MEDIA ETHICS & SAFETY INTRODUCTION TO MOBILE</li>
          <li>
            VIDEOGRAPHY & CONTENT CREATION STORYTELLING FOR DIGITAL CONTENT
          </li>
          <li>
            INTRODUCTION TO CAPCUT BASIC VIDEO EDITING (HANDS-ON) CREATIVE
          </li>
          <li>EFFECTS & FILTERS</li>
        </ol>
      </div>
      <div className="course__join">
        <Card>
          <div className="card__content">
            <h2 className="underline-header">Who Can Join?</h2>
            <p>
              At Data-Lead Africa, we believe every teen should have the
              opportunity to thrive in the world of digital creativity. Our
              hands-on bootcamp is designed to make video production,
              photography, and social media content creation accessible and
              exciting for all skill levels. Whether you're a beginner or just
              curious, our expert facilitators break things down step by step—no
              prior experience needed. We start from the basics and make every
              tool and concept relatable, fun, and easy to grasp
            </p>
          </div>
        </Card>
      </div>
      <div className="course__payment">
        <h2 className="underline-header">Price</h2>
        <div className="payment__group">
          <Card extraClasses="payment__card">
            <div>
              <div className="payment__details">
                <p className="payment__title">EARLY BIRD</p>
                <p className="payment__price">₦80,000</p>
                <hr />
              </div>
              <img
                className="payment__img"
                src="/assets/course/train.svg"
                alt=""
              />
            </div>
          </Card>
          <Card extraClasses="payment__card">
            <div>
              <div className="payment__details">
                <p className="payment__title">REGULAR</p>
                <p className="payment__price">₦100,000</p>
                <hr />
              </div>
              <img
                className="payment__img"
                src="/assets/course/train.svg"
                alt=""
              />
            </div>
          </Card>
        </div>
      </div>
      <div className="call-to-action__wrapper">
        <CallToAction>
          <div className="call-to-action__content">
            <h2>Ready to Make Amazing Content? Let’s Get Started!</h2>
            <p>
              Step into a dynamic learning environment where teens don’t just
              watch—they create
            </p>
            <a
              href="https://dataleadafrica.us12.list-manage.com/subscribe?u=c6fa2b9b8050a49c42f4b6543&id=e483f81efd"
              className="btn"
            >
              Enrol now
            </a>
          </div>
        </CallToAction>
      </div>
    </div>
  );
}
