import { Route } from "react-router";

import { routes } from "../routes";
import LearnerLogin from "./Login/page";
import LearnerDashboard from "./Dashboard/page";
import LearnerAssessment from "./Assessment/page";
import StaffPortal from "./Staff/page";

export default function learningRouter() {
  return (
    <>
      <Route path={routes.learnerLogin} element={<LearnerLogin />} />
      <Route path={routes.myLearning} element={<LearnerDashboard />} />
      <Route path={routes.learnerModule} element={<LearnerAssessment />} />
      <Route path={routes.staffPortal} element={<StaffPortal />} />
    </>
  );
}
