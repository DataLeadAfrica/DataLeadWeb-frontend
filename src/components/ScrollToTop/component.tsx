import { useEffect } from "react";
import { useLocation } from "react-router";

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scroll({
      behavior: "instant",
      top: 0,
    });
  }, [location]);

  return null;
};

export default ScrollToTop;
