import { Route } from "react-router";

import { routes } from "../routes";

import data_analytics from "./assets/data-analytics.svg";
import data_science from "./assets/data-science.svg";
import bioinformatics from "./assets/bioinformatics.svg";
import digital_creation from "./assets/digital-creation.svg";
import employability_entrepreneurship from "./assets/employability-entrepreneurship.svg";
import research_methodologies from "./assets/research-methodologies.svg";
import hr_analytics from "./assets/hr-analytics.svg";
import business_analytics from "./assets/business-analytics.svg";

import Courses from "./page";
import Course from "./Course/page";
import { ReactNode } from "react";

export type Modules = { [head: string]: string };
export type ModulesWithTracks = { [key: string]: { [head: string]: string } };

export interface CourseInfo {
  imgSrc: string;
  link: string;
  name: string;
  desc: string;
  price: string;
  modules: Modules | ModulesWithTracks;
  videoEmbed?: ReactNode;
  formLink?: string;
}

const courseInfos: Array<CourseInfo> = [
  {
    imgSrc: data_analytics,
    link: routes.coursesDataAnalytics,
    name: "Data Analytics",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "The Data-Lead Africa Data Analytics Bootcamp is more than a training, it is a launchpad for your career in to research and analytics. Over three months of immersive, expert-led learning, you’ll gain the skills to manage data end-to-end, while also learning how to apply analytics to real-world challenges across sectors and policy domains.",
    price: "250,000",
    modules: {
      "Qualitative Data Analysis":
        "Dive into the world of qualitative data analysis using industry-standard software like Nvivo, Atlas.ti, and QDA Miner. Learn to dissect and interpret data for meaningful insights.",
      "Quantitative Data Analysis":
        "Explore the quantitative side of data with hands-on experience in STATA, R, and SPSS. Understand statistical methods, modeling, and data manipulation to make informed decisions.",
      "Data Storytelling and Visualization":
        "Discover the art of data storytelling and visualization. Learn how to use Power BI and Microsoft Excel to convey your data insights effectively to a wide audience.",
      "Database Management":
        "Gain proficiency in managing databases using SQL. Master the art of structuring, querying, and retrieving data from databases efficiently. ",
      "Advanced Data Collection":
        "Elevate your data collection techniques with Kobo Toolbox, a powerful tool for comprehensive data collection, management, and complex analytics.",
    },
    videoEmbed: (
      <iframe
        src="https://www.youtube.com/embed/KvoT544sX70?si=9z_CvoeypYo-NVJt"
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      ></iframe>
    ),
  },
  {
    imgSrc: data_science,
    link: routes.coursesDataScience,
    name: "Data Science",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/176414535908853525/share",
    desc: "Our Data Science Training is a comprehensive 3-month program designed to equip participants with the foundational and practical skills required to launch a career in data science. Whether you're new to the field or looking to expand your analytical capabilities, this program provides hands-on experience in the tools and techniques used by data professionals worldwide.",
    price: "250,000",
    modules: {
      "Python Programming":
        "Understand programming fundamentals and build functional scripts for data tasks.",
      "Pandas & NumPy":
        "Learn to manipulate, clean, and analyze datasets using powerful Python libraries.",
      "Machine Learning":
        "Explore core machine learning concepts and apply basic models for prediction and classification.",
      "SQL for Data Management":
        "Master database queries, data extraction, and relational data handling. Gain proficiency in managing databases using SQL.",
      "Power BI":
        "Develop professional dashboards and visualize insights that drive decision-making.",
    },
  },
  {
    imgSrc: employability_entrepreneurship,
    link: routes.coursesEmployability,
    name: "Employability & Entrepreneurship",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "The Employability and Entrepreneurship Training at Data-Lead Africa is designed to equip young professionals, recent graduates, and aspiring entrepreneurs with the skills, mindset, and tools needed to either thrive in the workforce or build successful businesses. For those entering the job market or launching a startup, 2-week hands-on program offers practical, real-world knowledge that sets you apart.",
    price: "100,000",
    modules: {
      "CV Writing, Job Applications & Personal Branding": "",
      "Communication & Interview Skills": "",
      "Work Ethics, Emotional Intelligence & Professionalism": "",
      "Digital Literacy & Workplace Tools (Google Suite, MS Office, etc.)": "",
      "Career Planning & LinkedIn Optimization": "",
      "Business Idea Generation & Validation": "",
      "Business Model Canvas & Lean Startup Methods": "",
      "Financial Planning & Budgeting": "",
      "Pitching & Fundraising Basics": "",
      "Marketing & Branding for Small Businesses": "",
    },
  },
  {
    imgSrc: business_analytics,
    link: routes.coursesBusinessAnalytics,
    name: "Business Analytics",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "Our Business Analytics bootcamp is designed for professionals, entrepreneurs, and managers to gain practical skills to analyze business data and make smarter decisions. Whether you're looking to improve operations, understand customer behavior, or track performance, this course gives you the tools to turn business data into clear, actionable insights. This course introduces the core concepts and tools of business analytics, equipping participants to optimize operational outcomes.",
    price: "195,000",
    modules: {
      "Fundamentals of Business Analytics and Data-Driven Strategy": "",
      "Microsoft Excel for Business Analysis": "",
      "Data Visualization with Power BI": "",
      "Introduction to SQL for Business Data": "",
      "Key Business Metrics and KPIs": "",
      "Real-Life Business Case Analysis": "",
    },
  },
  {
    imgSrc: bioinformatics,
    link: routes.coursesBioInformatics,
    name: "Bioinformatics",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "Our Bioinformatics Training program is tailored for students, researchers, and professionals in the biological sciences who want to harness the power of data in modern biological research. This 3-month course introduces participants to the tools and techniques used to analyze biological data, with a strong focus on computational biology, genomics, and data-driven health research.",
    price: "300,000",
    modules: {
      "Introduction to Bioinformatics & Genomic Data": "",
      "Sequence Alignment & Gene Annotation": "",
      "Basic Programming with Python or R for BioinformaticsMachine Learning":
        "",
      "Biological Databases & Data Retrieval": "",
      "Statistical Analysis of Biological Data": "",
      "Visualization of Genomic Data": "",
      "Applications of Bioinformatics": "",
    },
  },
  {
    imgSrc: digital_creation,
    link: routes.coursesDigitalCreation,
    name: "Digital Creators",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "Give your child a fun and productive summer! This exciting hands-on summer bootcamp is designed for kids and teens (ages 12–17) who want to explore the world of digital content creation. From vlogging and photography to social media storytelling, they will learn how to plan, film, edit, and share amazing content using popular tools and apps. It’s the perfect blend of creativity, tech skills, and summer fun, setting them up to be confident, future ready creators!",
    price: "100,000",
    modules: {
      "Introduction To Digital Platforms Mobile Photography Basics": "",
      "Introduction To Photoshop Graphic Design Basics Personal Branding": "",
      "Basics Social Media Ethics & Safety Introduction To Mobile": "",
      "Videography & Content Creation Storytelling For Digital Content": "",
      "Introduction To Capcut Basic Video Editing (Hands-On) Creative": "",
      "Effects & Filters": "",
    },
  },
  {
    imgSrc: research_methodologies,
    link: routes.coursesResearchMethodologies,
    name: "Research Methodology and Manuscript Writing",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "This intensive program is designed to equip you with essential skills in research methodology and academic writing. Whether you’re a postgraduate student preparing your thesis, a researcher aiming to publish, an NGO staff member evaluating projects, or an early-career professional building research skills, this course provides a comprehensive, hands-on learning experience.",
    price: "100,000",
    modules: {
      "Understanding research types: quantitative, qualitative, and mixed methods":
        "",
      "Designing a solid research question, objectives, and hypothesis": "",
      "Sampling methods and data collection techniques": "",
      "How to write literature reviews and conceptual frameworks": "",
      "Data analysis and interpretation basics": "",
      "Structure and writing of academic manuscripts for journal submission":
        "",
      "Referencing using tools like Zotero and Mendeley": "",
      "Common reasons for manuscript rejection and how to avoid them": "",
    },
  },
  {
    imgSrc: hr_analytics,
    link: routes.coursesHrAnalytcis,
    name: "HR Analytics",
    formLink:
      "https://preview.mailerlite.io/forms/1758808/163980287251842919/share",
    desc: "The HR Analytics is designed to empower Human Resources professionals with the data skills needed to make informed workforce decisions. This 1-month course bridges HR and data analysis, equipping participants to interpret people-related data, uncover workforce trends, and make evidence-based HR decisions.Whether you're an HR officer, manager, or aspiring data-driven professional, this program will give you the tools to align HR strategies with organizational goals using data.",
    price: "195,000",
    modules: {
      "Introduction to HR Analytics and Data-Driven HR": "",
      "Data Collection and Cleaning Techniques for HR": "",
      "Key HR Metrics (Turnover, Time to Hire, Absenteeism, etc.)": "",
      "Using Excel and SQL for HR Data Management": "",
      "Power BI Dashboards for Workforce Reporting": "",
      "Introduction to Predictive Analytics for HR": "",
      "Data-Driven Recruitment, Retention, and Performance Evaluation": "",
    },
  },
];

export default function courseRouter() {
  return (
    <>
      <Route
        path={routes.courses}
        element={<Courses courseInfos={courseInfos} />}
      />
      {courseInfos.map((v) => {
        return (
          <Route
            path={v.link}
            element={
              <Course
                name={v.name}
                desc={v.desc}
                modules={v.modules}
                price={v.price}
                videoEmbed={v.videoEmbed}
                formLink={v.formLink}
              />
            }
          />
        );
      })}
    </>
  );
}
