import { useLocation } from "react-router";

import Header from "../../../components/Header/component";
import Footer from "../../../components/Footer/component";
import { routes } from "../../routes";

// The site Header and Footer, except in the control room.
//
// WHY THE CONTROL ROOM IS DIFFERENT FROM EVERY OTHER PAGE, including
// the blog studio, which does keep them. It is a full height tool: the
// rail is sticky at calc(100vh - 60px) and the top bar is sticky at
// zero, and both of those assume they own the window. Put the site
// header above them and the rail starts 90 pixels down, runs 90 pixels
// off the bottom, and the control room's own top bar sits in the middle
// of the page under a second one.
//
// So this is not a matter of taste about chrome. The sticky layout is
// wrong with a header above it, and the two honest fixes are to teach
// every offset about a header whose height can change, or to not put one
// there. The second is one component and no arithmetic.
//
// IT IS KEYED ON THE PATH, not on a prop threaded through the router,
// because Header and Footer are rendered outside <Routes> and a route
// cannot reach them. Checking the address is the only thing available,
// and it is also the only thing that is true.

export function SiteChrome({ which }: { which: "header" | "footer" }) {
  const { pathname } = useLocation();
  // startsWith, so /lms/studio/courses/<id>/questions is covered too.
  if (pathname === routes.studio || pathname.startsWith(routes.studio + "/")) return null;
  return which === "header" ? <Header /> : <Footer />;
}
