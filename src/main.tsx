import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./reset.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Index from "./Index";
import Blog from "./pages/Blog";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Header />
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/blog" element={<Blog />} />
    </Routes>
    <Footer />
  </BrowserRouter>,
);
