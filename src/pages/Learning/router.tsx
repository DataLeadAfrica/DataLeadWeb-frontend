import { Route } from "react-router";

import { routes } from "../routes";
import LearnerLogin from "./Login/page";
import LearnerDashboard from "./Dashboard/page";

export default function learningRouter() {
  return (
    <>
      <Route path={routes.learnerLogin} element={<LearnerLogin />} />
      <Route path={routes.myLearning} element={<LearnerDashboard />} />
    </>
  );
}
