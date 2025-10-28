import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { Helmet } from "react-helmet";
import "./global.css";
import ScrollToTop from "./components/ScrollToTop/component";
import Header from "./components/Header/component";
import Footer from "./components/Footer/component";

import { routes } from "./pages/routes";
import NotFound from "./pages/NotFound/page";
import Index from "./pages/Index/page";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Helmet>
        <script>
          {`
            (function(w,d,e,u,f,l,n){w[f]=w[f]||function(){(w[f].q=w[f].q||[])
            .push(arguments);},l=d.createElement(e),l.async=1,l.src=u,
            n=d.getElementsByTagName(e)[0],n.parentNode.insertBefore(l,n);})
            (window,document,'script','https://assets.mailerlite.com/js/universal.js','ml');
            ml('account', '1758808');
          `}
        </script>
      </Helmet>
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path={routes.index} element={<Index />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
