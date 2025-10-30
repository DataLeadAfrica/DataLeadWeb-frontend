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
import ourTeamRouter from "./pages/OurTeam/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
        {ourTeamRouter()}
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
