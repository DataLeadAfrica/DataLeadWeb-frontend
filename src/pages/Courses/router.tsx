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
import ai_ml_kids from "./assets/ai-ml-kids.svg";
import python_kids from "./assets/python-kids.svg";

import Courses from "./page";
import Course from "./Course/page";
import Kids from "./Kids/page";
import { ReactNode } from "react";
import { TrainingShot } from "../../components/TrainingGallery/component";

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
  tagline?: string;
  duration?: string;
  cohortNote?: string;
  outcomes?: string[];
  tools?: string[];
  whoFor?: string[];
  faqs?: { q: string; a: string }[];
  scholarship?: boolean;
  gallery?: TrainingShot[];
  /** Marks a Summer Bootcamp for Kids track. Drives the kids section + menu. */
  kids?: boolean;
  ageRange?: string;
}

// Shared training photos for the adult course pages. Kids pages will pass
// their own set later. Files live in public/assets/training/.
const ADULT_TRAINING: TrainingShot[] = [
  { src: "/assets/training/training-sql-session.jpg", caption: "Live SQL session" },
  { src: "/assets/training/training-excel-session.jpg", caption: "Excel and data cleaning" },
  { src: "/assets/training/training-r-session.jpg", caption: "R programming class" },
  { src: "/assets/training/training-r-session-2.jpg", caption: "Working through R together" },
  { src: "/assets/training/training-pair-programming.jpg", caption: "Pair programming in class" },
  { src: "/assets/training/training-lab-pairing.jpg", caption: "Hands-on lab" },
];

const courseInfos: Array<CourseInfo> = [
  {
    imgSrc: data_analytics,
    link: routes.coursesDataAnalytics,
    name: "Data Analytics",
    formLink:
      "https://tally.so/r/lbNEBp",
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
    tagline:
      "Turn raw data into decisions. A hands-on, mentor-led programme that makes you job-ready in three months, online or onsite in Abuja, open to learners across Africa.",
    duration: "3 months",
    cohortNote: "Next cohort now enrolling · limited seats",
    scholarship: true,
    outcomes: [
      "Collect and clean real-world datasets end to end",
      "Store and query data with SQL",
      "Run descriptive, inferential and predictive analysis",
      "Build interactive dashboards in Power BI",
      "Turn analysis into clear, decision-ready recommendations",
      "Graduate with a portfolio-ready capstone project",
    ],
    tools: [
      "Excel", "SPSS", "Stata", "Python", "R", "MySQL",
      "Power BI", "NVivo", "QDA Miner", "ArcGIS", "Kobo Toolbox",
    ],
    whoFor: [
      "Aspiring data analysts and recent graduates",
      "Career-changers moving into data",
      "Researchers who want stronger analysis skills",
      "Monitoring and evaluation and programme staff",
    ],
    faqs: [
      { q: "Do I need coding or data experience?", a: "No. The programme starts from the basics and builds up to job-ready skills. Beginners are welcome." },
      { q: "Is it online or onsite?", a: "Both. You can join live online from anywhere, or in person at our Abuja hub. Sessions run Monday to Friday." },
      { q: "What laptop do I need?", a: "Any laptop running Windows, macOS or Linux with at least 4GB RAM and about 250GB storage, plus a stable internet connection." },
      { q: "Will I get a certificate?", a: "Yes, a Data-Lead Africa certificate, plus a portfolio-ready capstone project you can show employers." },
      { q: "Can I pay in installments?", a: "Yes. You can spread payment as three payments of ₦100,000 over the term (₦300,000 total), or pay ₦250,000 once." },
      { q: "Is there an NYSC discount?", a: "Yes. Serving corps members in Nigeria pay ₦150,000. You will show proof of NYSC at onboarding." },
    ],
  },
  {
    imgSrc: data_science,
    link: routes.coursesDataScience,
    name: "AI & Machine Learning",
    formLink:
      "https://tally.so/r/0QEWM9",
    desc: "Our AI & Machine Learning Training is a comprehensive 3-month program designed to equip participants with the foundational and practical skills required to launch a career in AI & Machine Learning. Whether you're new to the field or looking to expand your analytical capabilities, this program provides hands-on experience in the tools and techniques used by data professionals worldwide.",
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
      "#",
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
      "#",
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
      "#",
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
    kids: true,
    ageRange: "12 to 17",
    formLink:
      "#",
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
      "#",
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
    imgSrc: ai_ml_kids,
    link: routes.coursesAiMlKids,
    name: "AI & ML for Kids",
    kids: true,
    ageRange: "8 to 17",
    formLink: "#",
    desc: "A month of curious, hands-on fun where kids discover how machines learn, train their very own AI and build a smart project, safely and responsibly. Artificial intelligence is all around us, in phones, games and apps. In one month your child learns what AI really is, trains their own simple models with kid-friendly tools, builds a smart project and explores how to use AI fairly and responsibly.",
    price: "100,000",
    tagline:
      "Kids train real models with simple, visual tools, no hard maths. One month, no experience needed.",
    duration: "1 month",
    cohortNote: "Summer cohort now enrolling",
    modules: {
      "What is AI?": "Spot AI all around us and understand how machines learn.",
      "Teach a Machine": "Train a simple AI to recognise pictures and sounds.",
      "AI Sees & Hears": "Fun experiments with image and sound recognition.",
      "Games & Chatbots": "Build simple smart games and friendly chatbots.",
      "Fair & Friendly AI": "Explore fairness and how to use AI responsibly.",
      "My First AI Project": "Create an AI project and present it to the class.",
    },
    outcomes: [
      "Explain what AI is, in their own words",
      "Train a simple image and sound recognition model",
      "Build a smart game or a friendly chatbot",
      "Talk about fairness and safe, responsible use of AI",
      "Finish a project of their own and present it to the class",
    ],
    tools: ["Teachable Machine", "Scratch", "Kid-friendly AI tools"],
    whoFor: [
      "Kids and teens, ages 8 to 17",
      "Total beginners",
      "Curious minds and young inventors",
      "Future AI creators",
    ],
    faqs: [
      { q: "Does my child need any experience?", a: "No. Everything starts from the beginning. No coding and no maths beyond what they already know at school." },
      { q: "How long is it?", a: "One month, run as a summer bootcamp." },
      { q: "What will they leave with?", a: "Their own AI project, which they present to the class on the final day." },
      { q: "Is it safe?", a: "Yes. Small classes, kid-appropriate tools, and a lesson dedicated to using AI fairly and responsibly." },
    ],
  },
  {
    imgSrc: python_kids,
    link: routes.coursesPythonKids,
    name: "Python Coding for Kids",
    kids: true,
    ageRange: "8 to 17",
    formLink: "#",
    desc: "A playful first month of real coding. Kids write their own Python programs, draw with code and build a mini game, all while having a blast. Python is one of the world's most popular programming languages, and it is friendly enough for beginners. In one month, your child goes from their very first line of code to building and sharing a small project, learning to think, solve problems and create like a real programmer.",
    price: "100,000",
    tagline:
      "Their first real programming language. From first line of code to first game, in one month.",
    duration: "1 month",
    cohortNote: "Summer cohort now enrolling",
    modules: {
      "Hello, Code!": "Meet Python and write a first program that actually runs.",
      "Words & Numbers": "Use variables to store words and numbers and talk to the computer.",
      "Making Decisions": "Teach programs to choose with if-and-else, just like a game.",
      "Loops & Turtle Art": "Repeat with loops and draw cool shapes with turtle graphics.",
      "Functions & Games": "Reuse code with functions and build a simple, fun game.",
      "Show-and-Tell": "Build a mini project and present it to the class.",
    },
    outcomes: [
      "Write and run their own Python programs",
      "Use variables, decisions and loops with confidence",
      "Draw shapes and art with turtle graphics",
      "Build a small game from scratch",
      "Present a mini project to the class",
    ],
    tools: ["Python", "Turtle graphics", "Thonny"],
    whoFor: [
      "Kids and teens, ages 8 to 17",
      "Total beginners",
      "Curious problem-solvers and young game-makers",
      "Future coders",
    ],
    faqs: [
      { q: "Does my child need any experience?", a: "No. They start with their very first line of code." },
      { q: "How long is it?", a: "One month, run as a summer bootcamp." },
      { q: "What will they leave with?", a: "A mini project of their own, presented to the class on the final day." },
      { q: "Why Python?", a: "It is one of the world's most used languages, and it is friendly enough for a beginner's first line of code." },
    ],
  },
  {
    imgSrc: hr_analytics,
    link: routes.coursesHrAnalytcis,
    name: "HR Analytics",
    formLink:
      "#",
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
      <Route
        path={routes.coursesKids}
        element={<Kids courseInfos={courseInfos.filter((c) => c.kids)} />}
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
                programmes={courseInfos.map((c) => c.name)}
                tagline={v.tagline}
                duration={v.duration}
                cohortNote={v.cohortNote}
                outcomes={v.outcomes}
                tools={v.tools}
                whoFor={v.whoFor}
                faqs={v.faqs}
                scholarship={v.scholarship}
                gallery={v.gallery || ADULT_TRAINING}
              />
            }
          />
        );
      })}
    </>
  );
}
