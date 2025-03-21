import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import "./reset.css";
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
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
