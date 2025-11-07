import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import "./global.css";
import ScrollToTop from "./components/ScrollToTop/component";
import Header from "./components/Header/component";
import Footer from "./components/Footer/component";

import { routes } from "./pages/routes";
import NotFound from "./pages/NotFound/page";
import Index from "./pages/Index/page";
import WhoWeAre from "./pages/WhoWeAre/page";
import ContactUs from "./pages/ContactUs/page";
import PrivacyPolicy from "./pages/PrivacyPolicy/page";
import ourTeamRouter from "./pages/OurTeam/router";
import blogRouter from "./pages/Blog/router";
import researchRouter from "./pages/Research/router";
import courseRouter from "./pages/Courses/router";
import consultancyRouter from "./pages/Consultancy/router";
import successRouter from "./pages/Success/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
        <Route path={routes.whoWeAre} element={<WhoWeAre />} />
        <Route path={routes.contactUs} element={<ContactUs />} />
        <Route path={routes.privacyPolicy} element={<PrivacyPolicy />} />
        {ourTeamRouter()}
        {blogRouter()}
        {researchRouter()}
        {courseRouter()}
        {consultancyRouter()}
        {successRouter()}
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
