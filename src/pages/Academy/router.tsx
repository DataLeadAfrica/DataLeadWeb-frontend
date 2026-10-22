import { Suspense, lazy } from "react";
import { Route } from "react-router";

import { routes } from "../routes";
import RequireAccount from "./RequireAccount";
import PreviewNotice from "./ui/PreviewNotice";
import Waiting from "./ui/Waiting";

// Every Academy route. Mounted from src/main.tsx the same way the other
// routers are, so there is one place to look for what /lms contains.
//
// LOADED SEPARATELY FROM THE REST OF THE SITE. React.lazy and a dynamic
// import mean the Academy's code, its stylesheet and its mono font are
// downloaded only by somebody who opens an Academy page. Everybody
// reading the blog or looking at the bootcamps pays nothing for it.
// That matters most on the phone and the connection the Academy is for.
//
// Suspense needs something to show while a page arrives. It is not a
// spinner: it is a block the same size as the page, so nothing on the
// screen jumps when the real page replaces it. A layout that shifts
// under somebody's thumb as they reach for a button is the most
// annoying thing a page can do, and search engines now measure it.
//
// Only /lms/me is behind RequireAccount. The three public pages and the
// three account pages all have to be reachable by somebody who is not
// signed in, which is the whole point of them.

const AcademyLanding = lazy(() => import("./Landing/page"));
const AcademyCourses = lazy(() => import("./Courses/page"));
const AcademyCourse = lazy(() => import("./Course/page"));
const AcademyPath = lazy(() => import("./Path/page"));
const AcademySignUp = lazy(() => import("./SignUp/page"));
const AcademySignIn = lazy(() => import("./SignIn/page"));
const AcademyReset = lazy(() => import("./Reset/page"));
const AcademyMe = lazy(() => import("./Me/page"));

// Phase 4. Four more pages, each loaded on its own: somebody reading
// the blog pays nothing for the lesson player, and the player's biggest
// piece, YouTube's own script, is not even requested until a lesson is
// opened.
const AcademyMyCourse = lazy(() => import("./Learn/MyCourse/page"));
const AcademyLesson = lazy(() => import("./Learn/Player/page"));
const AcademyQuiz = lazy(() => import("./Learn/Quiz/page"));
const AcademyComplete = lazy(() => import("./Learn/Complete/page"));
const AcademyExam = lazy(() => import("./Learn/Exam/page"));

// Every Academy page goes through here, which is why the preview
// notice is rendered here and not in eleven separate pages. It renders
// nothing at all once ACADEMY_PUBLIC is true.
//
// It is OUTSIDE the Suspense boundary on purpose: the notice should be
// on the screen while the page itself is still arriving, not appear a
// moment after it.
function page(element: React.ReactNode) {
  return (
    <>
      <PreviewNotice />
      <Suspense fallback={<Waiting />}>{element}</Suspense>
    </>
  );
}

export default function academyRouter() {
  return [
    <Route key="lms" path={routes.academy} element={page(<AcademyLanding />)} />,
    <Route
      key="lms-courses"
      path={routes.academyCourses}
      element={page(<AcademyCourses />)}
    />,
    <Route
      key="lms-course"
      path={routes.academyCourse}
      element={page(<AcademyCourse />)}
    />,
    // The path page is public: a path is one of the things somebody is
    // deciding about before they have an account, and what they have
    // done to it is simply empty when they are signed out.
    <Route
      key="lms-path"
      path={routes.academyPath}
      element={page(<AcademyPath />)}
    />,
    <Route key="lms-up" path={routes.academySignUp} element={page(<AcademySignUp />)} />,
    <Route key="lms-in" path={routes.academySignIn} element={page(<AcademySignIn />)} />,
    <Route key="lms-rst" path={routes.academyReset} element={page(<AcademyReset />)} />,
    <Route
      key="lms-me"
      path={routes.academyMe}
      element={page(
        <RequireAccount>
          <AcademyMe />
        </RequireAccount>,
      )}
    />,
  
    // THE LEARNING PAGES. All four behind RequireAccount, because every
    // one of them shows one person's own progress.
    //
    // THE ORDER MATTERS, and not in the way it looks. React Router v7
    // ranks routes by how specific they are rather than by the order
    // they are written, and a static segment beats a dynamic one. So
    // /lms/learn/:slug/complete and /lms/learn/:slug/quiz/:quizId both
    // win against /lms/learn/:slug/:lessonId. Writing them in this
    // order as well costs nothing and means the file reads the way the
    // router behaves. There is a test for it, because getting it wrong
    // would send somebody finishing a course into a lesson player
    // hunting for a lesson called "complete".
    <Route
      key="lms-learn"
      path={routes.academyLearn}
      element={page(
        <RequireAccount>
          <AcademyMyCourse />
        </RequireAccount>,
      )}
    />,
    <Route
      key="lms-complete"
      path={routes.academyComplete}
      element={page(
        <RequireAccount>
          <AcademyComplete />
        </RequireAccount>,
      )}
    />,
    <Route
      key="lms-exam"
      path={routes.academyExam}
      element={page(
        <RequireAccount>
          <AcademyExam />
        </RequireAccount>,
      )}
    />,
    <Route
      key="lms-path-exam"
      path={routes.academyPathExam}
      element={page(
        <RequireAccount>
          <AcademyExam kind="path" />
        </RequireAccount>,
      )}
    />,
    <Route
      key="lms-quiz"
      path={routes.academyQuiz}
      element={page(
        <RequireAccount>
          <AcademyQuiz />
        </RequireAccount>,
      )}
    />,
    <Route
      key="lms-lesson"
      path={routes.academyLesson}
      element={page(
        <RequireAccount>
          <AcademyLesson />
        </RequireAccount>,
      )}
    />,
];
}
