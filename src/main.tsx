import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import "./global.css";
import ScrollToTop from "./components/ScrollToTop/component";
import { SiteChrome } from "./pages/Academy/Studio/Chrome";

import { routes } from "./pages/routes";
import NotFound from "./pages/NotFound/page";
import Index from "./pages/Index/page";
import WhoWeAre from "./pages/WhoWeAre/page";
import ContactUs from "./pages/ContactUs/page";
import PrivacyPolicy from "./pages/PrivacyPolicy/page";
import ourTeamRouter from "./pages/OurTeam/router";
import blogRouter from "./pages/Blog/router";
import Studio from "./pages/Studio/Studio";
import researchRouter from "./pages/Research/router";
import courseRouter from "./pages/Courses/router";
import consultancyRouter from "./pages/Consultancy/router";
import successRouter from "./pages/Success/router";
import certificatesRouter from "./pages/Certificates/router";
import learningRouter from "./pages/Learning/router";
import academyRouter from "./pages/Academy/router";
import studioRouter from "./pages/Academy/Studio/router";
import Certifications from "./pages/Certifications/page";
import TrainingCertificate from "./pages/TrainingCertificate/page";
import { MOBEP_TRAINING } from "./pages/TrainingCertificate/config";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <SiteChrome which="header" />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
        <Route path={routes.whoWeAre} element={<WhoWeAre />} />
        <Route path={routes.contactUs} element={<ContactUs />} />
        <Route path={routes.privacyPolicy} element={<PrivacyPolicy />} />
        <Route path="/studio" element={<Studio />} />
        {ourTeamRouter()}
        {blogRouter()}
        {researchRouter()}
        {courseRouter()}
        {consultancyRouter()}
        {successRouter()}
        {certificatesRouter()}
        <Route path={routes.certifications} element={<Certifications />} />
        <Route
          path={routes.mobepCertificate}
          element={<TrainingCertificate setup={MOBEP_TRAINING} />}
        />
        {learningRouter()}
        {academyRouter()}
        {/* The control room. Its routes sit beside the Academy's rather than
            inside them, because /lms/studio is a different place with a
            different guard, and nesting it under the Academy's routes
            would put a learner's PreviewNotice on a staff page. */}
        {studioRouter()}
      </Routes>
      <SiteChrome which="footer" />
    </BrowserRouter>
  </StrictMode>,
);
