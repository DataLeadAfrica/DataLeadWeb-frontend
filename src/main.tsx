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
import ourTeamRouter from "./pages/OurTeam/router";
import blogRouter from "./pages/Blog/router";
import researchRouter from "./pages/Research/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
        <Route path={routes.whoWeAre} element={<WhoWeAre />} />
        {ourTeamRouter()}
        {blogRouter()}
        {researchRouter()}
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
