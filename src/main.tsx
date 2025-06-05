import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./global.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Index from "./Index";
import Blog from "./pages/Blog";
import Researches from "./pages/Researches";
import WhoWeAre from "./pages/WhoWeAre";
import ContactUs from "./pages/ContactUs";
import OurTeam from "./pages/OurTeam";
import Courses from "./pages/Courses";
import DataAnalytics from "./pages/bootcamps/DataAnalytics";
import NotFound from "./pages/NotFound";
// import ComingSoon from "./pages/ComingSoon";
import ScrollToTop from "./components/ScrollToTop";
import ourTeamRoutes from "./routes/ourTeamRoutes.tsx";
import blogRoutes from "./routes/blogRoutes";
import researchRoutes from "./routes/researchRoutes";
import { routes } from "./routes";
import BlogPost from "./pages/BlogPost.tsx";
import courseRoutes from "./routes/courseRoutes.tsx";
import consultancyRoutes from "./routes/consultancyRoutes.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
        <Route path={routes.blog} element={<Blog />} />
        {blogRoutes()}
        <Route path={routes.research} element={<Researches />} />
        {researchRoutes()}
        <Route path={routes.whoWeAre} element={<WhoWeAre />} />
        <Route path={routes.contactUs} element={<ContactUs />} />
        <Route path={routes.ourTeam} element={<OurTeam />} />
        <Route path={routes.courses} element={<Courses />} />
        <Route path={routes.CoursesDataAnalytics} element={<DataAnalytics />} />

        {courseRoutes()}
        {ourTeamRoutes()}
        <Route
          path={routes.deafInTech}
          element={
            <BlogPost
              title="Deaf-In-Tech: Inclusion in tech, higher education, and employment."
              date=""
              imgSrc="/assets/deaf-in-tech.jpg"
              content="

The Deaf-In-Tech project is an Edtech inclusion program of Data-Lead Africa, focused on strengthening diversity, equity, and inclusion (DEI) in STEM, data analytics, higher education, and employment. It seeks to close the existing skill gap among ordinarily marginalized people. The key marginalized groups in low- and middle-income countries are Persons with Disabilities (PWDs), women, and girls. Through the SDGs agenda to create prosperous, peaceful, and equitable societies, much work is being done to improve equity, diversity, and inclusion. However, initiatives working to improve the inclusion of PWDs need to be higher.

Deaf-in-Tech focuses on equitably upskilling the capacities of Deaf and hard-of-hearing individuals and improving their employability through training in data analytics, edtech, and research methodologies. Data analytics is one of the most sought-after labor, employment, and higher learning skills. Even though data science has created teeming opportunities for young people and adults, PWDs in developing countries do not ordinarily have access to these skills due to their unique and peculiar learning needs.

Data-Lead Africa piloted the Deaf-in-Tech project in August 2022, where over 30 deaf people were trained in advanced data analytics, data visualization, and research tools at no cost to the beneficiaries. The training method adopts an inclusive and personalized approach suited to their needs.

Since 2022, we’ve held seven (7) successful cohorts, training over 1000 deaf individuals in different tech skills, including coding and resume writing/optimization. We have seen firsthand how the deaf can be a superpower in tech, where close attention and sharp minds are key. We have not just trained, we have created employment opportunities and raised Deaf mentors in the industry for our students.

As our impact grew, it became impracticable to meet the learning needs of the deaf outside of Abuja. So, we thought to create a digital classroom where distance is no barrier.

This is how DeafLearn came to be— a learning platform designed for deaf people.

DeafLearn is not just another learning platform where individuals can learn with subtitles

Here is a highlight of what is unique about the DeafLearn platform:

Deaf-Native Instruction: Sign Language (ASL) is used as the primary mode of instruction, aligning with deaf individuals’ natural learning process and fostering deeper understanding and engagement.

Tech-Focused Curriculum: Comprehensive video courses in ASL in high-demand tech skills like Java, SQL, and C++, with ongoing expansion into additional tracks.

Career-Pathing Support: Personalized mentorship, networking, and career readiness support to prepare trainees for successful entry into the tech workforce.

DeafLearn is more than just a learning platform; it’s a community of deaf tech pioneers helping each other thrive, breaking barriers with knowledge and opportunity.

We hope to build a future where we do not just focus on overcoming barriers within the sector, but on one that is truly inclusive, accessible, and welcome."
            />
          }
        />
        {consultancyRoutes()}
        {/* Reroutes */}
        <Route path="/about-us" element={<Navigate to={routes.whoWeAre} />} />
        <Route
          path="/abdulsalam-oluwatosin"
          element={<Navigate to={routes.ourTeamAbdul} />}
        />
        <Route
          path="/sefunmi-oluwole"
          element={<Navigate to={routes.ourTeamSefunmi} />}
        />
        <Route
          path="/dr-arowolo-ayoola"
          element={<Navigate to={routes.ourTeamDrAyo} />}
        />
        <Route
          path="/felicia-ayodele"
          element={<Navigate to={routes.ourTeamFelicia} />}
        />
        <Route
          path="/oche-loveth"
          element={<Navigate to={routes.ourTeamLoveth} />}
        />
        <Route
          path="/blessing-adem"
          element={<Navigate to={routes.ourTeamBlessing} />}
        />
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
