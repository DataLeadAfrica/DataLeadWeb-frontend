import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import "./global.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Index from "./Index";
import Blog from "./pages/Blog";
import Research from "./pages/Research";
import WhoWeAre from "./pages/WhoWeAre";
import ContactUs from "./pages/ContactUs";
import OurTeam from "./pages/OurTeam";
import DataAnalytics from "./pages/bootcamps/DataAnalytics";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path="/" element={<Index />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/research" element={<Research />} />
        <Route path="/who-we-are" element={<WhoWeAre />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/our-team" element={<OurTeam />} />
        <Route path="/data-analytics-bootcamp" element={<DataAnalytics />} />
        // Not finished pages
        <Route path="/business-analytics-bootcamp" element={<ComingSoon />} />
        <Route path="/data-science-bootcamp" element={<ComingSoon />} />
        <Route path="/human-resource-analytics" element={<ComingSoon />} />
        <Route path="/short-courses" element={<ComingSoon />} />
        <Route path="/deaf-in-tech" element={<ComingSoon />} />
        <Route path="/python-for-kids" element={<ComingSoon />} />
        <Route path="/digits-and-signs" element={<ComingSoon />} />
        <Route path="/digits-and-signs" element={<ComingSoon />} />
        <Route path="/bioinformatics" element={<ComingSoon />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
