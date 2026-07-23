import { Route } from "react-router";

import { routes } from "../routes";
import ClaimCertificate from "./Claim/page";
import VerifyCertificate from "./Verify/page";
import StaffCertificates from "./Staff/page";

export default function certificatesRouter() {
  return (
    <>
      <Route path={routes.myCertificate} element={<ClaimCertificate />} />
      <Route path={routes.verifyCertificate} element={<VerifyCertificate />} />
      <Route path={routes.staffCertificates} element={<StaffCertificates />} />
    </>
  );
}
