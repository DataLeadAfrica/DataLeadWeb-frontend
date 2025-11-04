import { Route } from "react-router";
import { ReactElement } from "react";

import { routes } from "../routes";

import Research from "./page";
import ResearchPost from "./Post/page";

import accountabilityPilotImage from "./assets/AAH.jpg";
import promotionOfMarketOrientedImg from "./assets/JICA.jpg";
import humanitarianAssistanceImg from "./assets/Mercy-corps.png";
import finalAssessmentReportImg from "./assets/nigeria-violence-usaid.png";
import northenEducationImg from "./assets/USAID.png";
import developmentOfBusinessImg from "./assets/water-aid.png";
import usaidAgribusinessImg from "./assets/social-impact-usaid.jpg";
// import johnHopkins from "./assets/john-hopkins.jpg";
// import njr from "./assets/NJR.png";
// import rfd from "./assets/RFD.jpg";
// import saveTheChildren from "./assets/save-the children.jpg";
// import untf from "./assets/UNTF.jpg";

import AccountabilityPilot from "./Post/posts/AccountabilityPilot";
import NorthenEducation from "./Post/posts/NorthenEducation";
import HumanitarianAssistance from "./Post/posts/HumanitarianAssistance";
import PromotionOfMarketOriented from "./Post/posts/PromotionOfMarketOriented";
import UsaidAgribusiness from "./Post/posts/UsaidAgribusiness";
import FinalAssessmentReport from "./Post/posts/FinalAssessmentReport";
import DevelopmentOfBusiness from "./Post/posts/DevelopmentOfBusiness";

export interface ResearchInfo {
  imgSrc: string;
  timeline: string;
  title: string;
  link: string;
  content: () => ReactElement;
}
const resarchInfos: Array<ResearchInfo> = [
  {
    imgSrc: developmentOfBusinessImg,
    timeline: "September - October 2025",
    title: "DEVELOPMENT OF BUSINESS CASE FOR REUSABLE MENSTRUAL PRODUCTS",
    link: routes.researchDevelopmentOfBusiness,
    content: DevelopmentOfBusiness,
  },
  {
    imgSrc: finalAssessmentReportImg,
    timeline: "December 2024",
    title:
      "FINAL ASSESSMENT REPORT USAID/NIGERIA VIOLENCE AND CONFLICT ASSESSMENT (VCA)",
    link: routes.researchFinalAssessmentReport,
    content: FinalAssessmentReport,
  },
  {
    imgSrc: usaidAgribusinessImg,
    timeline: "Dec 2021 - Feb 2022",
    title: "USAID AGRIBUSINESS INVESTMENT MIDTERM PERFORMANCE EVALUATION",
    link: routes.researchUsaidAgribusiness,
    content: UsaidAgribusiness,
  },
  {
    imgSrc: promotionOfMarketOrientedImg,
    timeline: "Oct - Nov 2021",
    title:
      "PROMOTION OF MARKET-ORIENTED AGRICULTURAL EXTENSION SYSTEM FOR LIVELIHOOD IMPROVEMENT IN NIGERIA (SHEP NIGERIA)",
    link: routes.researchPromotionOfMarketOriented,
    content: PromotionOfMarketOriented,
  },
  {
    imgSrc: humanitarianAssistanceImg,
    timeline: "Mar - Apr 2021",
    title: "HUMANITARIAN ASSISTANCE, LIVELIHOOD, FOOD SECURITY",
    link: routes.researchHumanitarianAssistance,
    content: HumanitarianAssistance,
  },
  {
    imgSrc: northenEducationImg,
    timeline: "Dec 2020 - Jan 2021",
    title: "NORTHERN EDUCATION INITIATIVE PLUS (NEI+)",
    link: routes.researchNothernEducation,
    content: NorthenEducation,
  },
  {
    imgSrc: accountabilityPilotImage,
    timeline: "Oct - Nov 2020",
    title: "ACCOUNTABILITY PILOT SURVEY IN BORNO STATE",
    link: routes.researchAccountabilityPilot,
    content: AccountabilityPilot,
  },
];

export default function researchRouter() {
  return (
    <>
      <Route
        path={routes.research}
        element={<Research researchInfos={resarchInfos} />}
      />
      {resarchInfos.map((v) => {
        return (
          <Route
            path={v.link}
            element={
              <ResearchPost
                imgSrc={v.imgSrc}
                title={v.title}
                timeline={v.timeline}
                content={v.content}
              />
            }
          />
        );
      })}
    </>
  );
}
