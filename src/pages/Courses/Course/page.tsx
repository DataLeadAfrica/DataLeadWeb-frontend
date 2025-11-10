import "./page.css";

import { Modules, ModulesWithTracks } from "../router";

import case_img from "./assets/case.svg";
import review_img from "./assets/review.svg";
import video_img from "./assets/video.svg";
import online_img from "./assets/online.svg";

import circle from "./assets/circle.svg";
import line from "./assets/line.svg";
import CallToAction from "../../../components/CallToAction/component";
import { ReactNode } from "react";

const structure_infos = [
  {
    imgSrc: video_img,
    title: "Video Content",
    desc: "High-quality easy-to-comprehend recorded video lessons",
  },
  {
    imgSrc: online_img,
    title: "Onsite & Online",
    desc: "Join and collaborate with other learners online and onsite",
  },
  {
    imgSrc: review_img,
    title: "Peer review sessions",
    desc: "Share knowledge with other interns and gain multidimensional perspectives of problem solving",
  },
  {
    imgSrc: case_img,
    title: "Case Studies",
    desc: "Work on real-life projects by applying what you learn to solve related business problems",
  },
];

export default function Course({
  name,
  desc,
  price,
  modules,
  videoEmbed,
}: {
  name: string;
  desc: string;
  modules: Modules | ModulesWithTracks;
  price: string;
  videoEmbed?: ReactNode;
}) {
  return (
    <div className="course">
      <div className="course__head">
        <div className="course__summary">
          <div>
            <h1 className="course__title">{name} Bootcamp</h1>
            <p className="course__desc">{desc}</p>
          </div>
          <div className="course__status">
            <i className="nf nf-fa-check_circle"></i> <p>Registration Open</p>
          </div>
        </div>
        <div className="course__plan">
          <div>
            <p>One Time Payment</p>
            <p className="plan__price">{price}</p>
          </div>
          <a
            href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share"
            className="btn btn--white"
          >
            Enrol Now
            <i className="nf nf-fa-arrow_right"></i>
          </a>
        </div>
      </div>
      <div className="course__structure">
        <div>
          <h2>Success Through Structured, Hands-On Training</h2>
        </div>
        <div className="structure__infos">
          {structure_infos.map((v) => {
            return (
              <div className="structure__info">
                <div className="info__img">
                  <img src={v.imgSrc} alt="" />
                </div>
                <div>
                  <p className="info__title">{v.title}</p>
                  <p>{v.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="course__modules">
        <h2>Modules</h2>
        <div className="modules__head">
          <p className="modules__title">What you will master</p>
          <p className="modules__desc">
            A complete breakdown of the core skills and knowledge you'll gain at
            every stage of the program
          </p>
        </div>
        <div className="modules__infos">
          {Object.entries(modules).map(([v, k], i) => {
            return (
              <div className="module__info">
                <div className="info__sep">
                  <img className="info__circle" src={circle} alt="" />
                  {i + 1 < Object.entries(modules).length && k.length > 0 && (
                    <img className="info__line" src={line} alt="" />
                  )}
                </div>
                <div className="info__content">
                  <p className="info__title">{v}</p>
                  {k.length > 0 && <p className="info__desc">{k}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="course__testimonial">
        <div className="testimonial__text">
          <div>
            <h2>Start This Course with an Expert by Your Side</h2>
            <p>
              This program is designed for your success. With our expert team
              and quality-first delivery, you have everything you need
            </p>
          </div>
          <a
            href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share"
            className="btn"
          >
            Enrol Now
          </a>
        </div>
        <div className="testimonial__video">{videoEmbed}</div>
      </div>

      <CallToAction
        heading="Ready to Accelerate Your Career?"
        btns={[
          <a
            href="https://preview.mailerlite.io/forms/1758808/163980287251842919/share"
            className="btn"
          >
            Enrol Now
          </a>,
          name == "Data Analytics" ? (
            <a
              href="https://drive.google.com/file/d/1Y_jiAI4rH_1V47b7787TP9PiqovORyEO/view?usp=sharing"
              className="btn btn--white"
            >
              Download Brochure
              <i className="nf nf-fa-arrow_right"></i>
            </a>
          ) : (
            <></>
          ),
        ]}
      />
    </div>
  );
}
