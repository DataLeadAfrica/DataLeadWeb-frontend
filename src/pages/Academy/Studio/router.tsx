import { Suspense, lazy } from "react";
import { Route } from "react-router";

import { routes } from "../../routes";
import Waiting from "../ui/Waiting";

// Every control room route.
//
// LOADED ON ITS OWN, like the Academy is. Thirteen staff pages, their
// stylesheet and their icons are downloaded by somebody who opens the
// control room and by nobody else. A learner watching a lesson on a
// phone pays nothing for the page that sets prices, and the staff side
// is the bigger of the two.
//
// EVERY ONE OF THEM IS BEHIND RequireStaff, which is inside each page
// rather than wrapped around the route. That is deliberate: a route
// added later cannot forget the wrapper, because the wrapper is the
// first thing the page itself does.
//
// There is no PreviewNotice here. That line is for learners, telling
// them the Academy is not open yet. Staff are the people building it.

const Overview = lazy(() => import("./Overview/page"));
const Courses = lazy(() => import("./Courses/page"));
const Builder = lazy(() => import("./Builder/page"));
const Questions = lazy(() => import("./Questions/page"));
const Paths = lazy(() => import("./Paths/page"));
const Areas = lazy(() => import("./Areas/page"));
const Learners = lazy(() => import("./Learners/page"));
const Staff = lazy(() => import("./Staff/page"));
const Certificates = lazy(() => import("./Certificates/page"));
const Reports = lazy(() => import("./Reports/page"));
const Settings = lazy(() => import("./Settings/page"));
const Popups = lazy(() => import("./Popups/page"));
const Health = lazy(() => import("./Health/page"));

function page(element: React.ReactNode) {
  return <Suspense fallback={<Waiting />}>{element}</Suspense>;
}

export default function studioRouter() {
  return [
    <Route key="stu" path={routes.studio} element={page(<Overview />)} />,
    <Route key="stu-c" path={routes.studioCourses} element={page(<Courses />)} />,
    // The more specific address first: /courses/:id/questions must not
    // be swallowed by /courses/:id.
    <Route key="stu-q" path={routes.studioQuestions} element={page(<Questions />)} />,
    <Route
      key="stu-pq"
      path={routes.studioPathQuestions}
      element={page(<Questions kind="path" />)}
    />,
    <Route key="stu-b" path={routes.studioBuilder} element={page(<Builder />)} />,
    <Route key="stu-p" path={routes.studioPaths} element={page(<Paths />)} />,
    <Route key="stu-a" path={routes.studioAreas} element={page(<Areas />)} />,
    <Route key="stu-l" path={routes.studioLearners} element={page(<Learners />)} />,
    <Route key="stu-s" path={routes.studioStaff} element={page(<Staff />)} />,
    <Route key="stu-cert" path={routes.studioCerts} element={page(<Certificates />)} />,
    <Route key="stu-r" path={routes.studioReports} element={page(<Reports />)} />,
    <Route key="stu-set" path={routes.studioSettings} element={page(<Settings />)} />,
    <Route key="stu-pop" path={routes.studioPopups} element={page(<Popups />)} />,
    <Route key="stu-h" path={routes.studioHealth} element={page(<Health />)} />,
  ];
}
