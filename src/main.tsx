import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
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
import ComingSoon from "./pages/ComingSoon";
import ScrollToTop from "./components/ScrollToTop";
import ourTeamRoutes from "./routes/ourTeamRoutes.tsx";
import blogRoutes from "./routes/blogRoutes";
import researchRoutes from "./routes/researchRoutes";
import { routes } from "./routes";

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
        <Route path={routes.dataAnalytics} element={<DataAnalytics />} />
        {ourTeamRoutes()}
        // Not finished pages
        <Route
          path="/courses/short-courses"
          element={<ComingSoon name="short courses" />}
        />
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
