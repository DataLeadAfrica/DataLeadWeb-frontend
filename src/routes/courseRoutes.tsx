import { Route } from "react-router";
import { routes } from "../routes";
import Course from "../pages/Course";

export default function courseRoutes() {
  return (
    <>
      <Route
        path={routes.CoursesDataScience}
        element={
          <Course
            name="Data Science"
            length="3 months"
            desc="Our Data Science Training is a comprehensive 3-month program designed to equip participants with the foundational and practical skills required to launch a career in data science. Whether you're new to the field or looking to expand your analytical capabilities, this program provides hands-on experience in the tools and techniques used by data professionals worldwide."
            highlightImg="/assets/course/data-science.png"
            modules={{
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
            }}
            price="250,000"
            benefit={true}
            priceImg="/assets/course/bolt.svg"
          />
        }
      />
      <Route
        path={routes.CoursesBioInformatics}
        element={
          <Course
            name="Bioinformatics"
            length="3 months"
            desc="Our Bioinformatics Training program is tailored for students, researchers, and professionals in the biological sciences who want to harness the power of data in modern biological research. This 3-month course introduces participants to the tools and techniques used to analyze biological data, with a strong focus on computational biology, genomics, and data-driven health research."
            highlightImg="/assets/course/bioinformatics.png"
            modules={{
              "Introduction to Bioinformatics & Genomic Data": "",
              "Sequence Alignment & Gene Annotation": "",
              "Basic Programming with Python or R for BioinformaticsMachine Learning":
                "",
              "Biological Databases & Data Retrieval": "",
              "Statistical Analysis of Biological Data": "",
              "Visualization of Genomic Data": "",
              "Applications of Bioinformatics": "",
            }}
            price="300,000"
            benefit={true}
            priceImg="/assets/course/cog.svg"
          />
        }
      />
      <Route
        path={routes.CoursesHrAnalytcis}
        element={
          <Course
            name="HR Analytics"
            length="1 month"
            desc="The HR Analytics is designed to empower Human Resources professionals with the data skills needed to make informed workforce decisions. This 1-month course bridges HR and data analysis, equipping participants to interpret people-related data, uncover workforce trends, and make evidence-based HR decisions.
Whether you're an HR officer, manager, or aspiring data-driven professional, this program will give you the tools to align HR strategies with organizational goals using data.
"
            highlightImg="/assets/course/hr-analytics.png"
            modules={{
              "Introduction to HR Analytics and Data-Driven HR": "",
              "Data Collection and Cleaning Techniques for HR": "",
              "Key HR Metrics (Turnover, Time to Hire, Absenteeism, etc.)": "",
              "Using Excel and SQL for HR Data Management": "",
              "Power BI Dashboards for Workforce Reporting": "",
              "Introduction to Predictive Analytics for HR": "",
              "Data-Driven Recruitment, Retention, and Performance Evaluation":
                "",
            }}
            price="195,000"
            benefit={false}
            priceImg="/assets/course/attention.svg"
          />
        }
      />
      <Route
        path={routes.CoursesBusinessAnalytics}
        element={
          <Course
            name="Business Analytics"
            length="1 month"
            desc="Our Business Analytics bootcamp is designed for professionals, entrepreneurs, and managers to gain practical skills to analyze business data and make smarter decisions. Whether you're looking to improve operations, understand customer behavior, or track performance, this course gives you the tools to turn business data into clear, actionable insights. This course introduces the core concepts and tools of business analytics, equipping participants to optimize operational outcomes."
            highlightImg="/assets/course/business-analytics.png"
            modules={{
              "Fundamentals of Business Analytics and Data-Driven Strategy": "",
              "Microsoft Excel for Business Analysis": "",
              "Data Visualization with Power BI": "",
              "Introduction to SQL for Business Data": "",
              "Key Business Metrics and KPIs": "",
              "Real-Life Business Case Analysis": "",
            }}
            price="195,000"
            benefit={false}
            priceImg="/assets/course/dollar.svg"
          />
        }
      />
      <Route
        path={routes.CoursesResearch}
        element={
          <Course
            name="Research Methodology and Manuscript Writing"
            length="2 weeks"
            desc="This intensive program is designed to equip you with essential skills in research methodology and academic writing. Whether you’re a postgraduate student preparing your thesis, a researcher aiming to publish, an NGO staff member evaluating projects, or an early-career professional building research skills, this course provides a comprehensive, hands-on learning experience."
            highlightImg="/assets/course/research.png"
            modules={{
              "Understanding research types: quantitative, qualitative, and mixed methods":
                "",
              "Designing a solid research question, objectives, and hypothesis":
                "",
              "Sampling methods and data collection techniques": "",
              "How to write literature reviews and conceptual frameworks": "",
              "Data analysis and interpretation basics": "",
              "Structure and writing of academic manuscripts for journal submission":
                "",
              "Referencing using tools like Zotero and Mendeley": "",
              "Common reasons for manuscript rejection and how to avoid them":
                "",
            }}
            price="100,000"
            benefit={false}
            priceImg="/assets/course/magnifying.svg"
          />
        }
      />
      <Route
        path={routes.CoursesEmployability}
        element={
          <Course
            name="Employability & Entrepreneurship"
            length="2 weeks"
            desc="The Employability and Entrepreneurship Training at Data-Lead Africa is designed to equip young professionals, recent graduates, and aspiring entrepreneurs with the skills, mindset, and tools needed to either thrive in the workforce or build successful businesses. For those entering the job market or launching a startup, 2-week hands-on program offers practical, real-world knowledge that sets you apart."
            highlightImg="/assets/course/employability.png"
            modules={{
              "Employability Track": {
                "CV Writing, Job Applications & Personal Branding": "",
                "Communication & Interview Skills": "",
                "Work Ethics, Emotional Intelligence & Professionalism": "",
                "Digital Literacy & Workplace Tools (Google Suite, MS Office, etc.)":
                  "",
                "Career Planning & LinkedIn Optimization": "",
              },
              "Entrepreneurship Track": {
                "Business Idea Generation & Validation": "",
                "Business Model Canvas & Lean Startup Methods": "",
                "Financial Planning & Budgeting": "",
                "Pitching & Fundraising Basics": "",
                "Marketing & Branding for Small Businesses": "",
              },
            }}
            price="100,000"
            benefit={false}
            priceImg="/assets/course/magnifying.svg"
          />
        }
      />
      <Route
        path={routes.CoursesDigitalCreation}
        element={
          <Course
            name="Digital Creation"
            length="4 weeks"
            desc="Unleash your creativity in this hands-on bootcamp designed especially for teens! Whether you're into vlogging, photography, or building your social media presence, this program teaches you how to plan, shoot, edit, and share content like a pro. Learn how to use popular digital tools and apps to create stunning videos, eye-catching photos, and engaging posts. Perfect for beginners and aspiring creators alike, this bootcamp helps you build practical skills that are fun, creative, and future-ready"
            highlightImg="/assets/course/digital-creation.png"
            modules={{
              "INTRODUCTION TO DIGITAL PLATFORMS": "",
              "MOBILE PHOTOGRAPHY BASICS": "",
              "INTRODUCTION TO PHOTOSHOP": "",
              "GRAPHIC DESIGN BASICS": "",
              "PERSONAL BRANDING BASICS": "",
              "SOCIAL MEDIA ETHICS & SAFETY": "",
              "INTRODUCTION TO MOBILE VIDEOGRAPHY & CONTENT CREATION": "",
              "STORYTELLING FOR DIGITAL CONTENT": "",
              "INTRODUCTION TO CAPCUT": "",
              "BASIC VIDEO EDITING (HANDS-ON)": "",
              "CREATIVE EFFECTS & FILTERS": "",
            }}
            price="60,000"
            benefit={false}
            priceImg="/assets/course/train.svg"
          />
        }
      />
    </>
  );
}
