import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./app.css";
import "./reset.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import App from "./App";
import Blog from "./Blog";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Header />
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/blog" element={<Blog />} />
    </Routes>
    <Footer />
  </BrowserRouter>,
);
