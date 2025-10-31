import { Route } from "react-router";
import { ReactElement } from "react";

import { routes } from "../routes";

import Blog from "./page";
import BlogPost from "./Post/page";
import WhyShouldIRegister from "./Post/posts/WhyShouldIRegister";
import Top7DataAnalytics from "./Post/posts/Top7DataAnalytics";
import HowNYSCMembersCan from "./Post/posts/HowNYSCMembersCan";
import FromBeginnerToAnalyst from "./Post/posts/FromBeginnerToAnalyst";
import ExcelVsPowerBI from "./Post/posts/ExcelVsPowerBI";
import SQLForBeginners from "./Post/posts/SQLForBeginners";
import DrivingInclusionWithData from "./Post/posts/DrivingInclusionWithData";

export interface BlogInfo {
  title: string;
  author: string;
  authorImgSrc: string;
  date: string;
  route: string;
  component: () => ReactElement;
}

const blogInfos: Array<BlogInfo> = [
  {
    title:
      "DRIVING INCLUSION WITH DATA: WHEN QUALITY STATISTICS MEET ACCESSIBILITY",
    author: "Deaf-In-Tech",
    authorImgSrc: "/assets/DIT-logo.png",
    date: "October 20th 2025",
    route: routes.blogDrivingInclusionWithData,
    component: DrivingInclusionWithData,
  },
  {
    title: "EXCEL VS POWER BI VS PYTHON: WHICH TOOL SHOULD YOU LEARN FIRST?",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "September 24th 2025",
    route: routes.blogExcelVsPowerBI,
    component: ExcelVsPowerBI,
  },
  {
    title: "SQL FOR BEGINNERS: WHY EVERY NIGERIAN GRADUATE SHOULD LEARN IT",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "September 24th 2025",
    route: routes.blogSQLForBeginners,
    component: SQLForBeginners,
  },
  {
    title: "TOP 7 DATA ANALYTICS SKILLS EMPLOYERS WANT IN NIGERIA (2025)",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "September 23rd 2025",
    route: routes.blogTop7DataAnalytics,
    component: Top7DataAnalytics,
  },
  {
    title:
      "HOW NYSC MEMBERS CAN LAUNCH A CAREER IN DATA ANALYTICS DURING SERVICE YEAR",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "September 23rd 2025",
    route: routes.blogHowNYSCMembersCan,
    component: HowNYSCMembersCan,
  },
  {
    title: "FROM BEGINNER TO ANALYST: 12 WEEKS TO A DATA CAREER IN ABUJA",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "September 23rd 2025",
    route: routes.blogFromBeginnerToAnalyst,
    component: FromBeginnerToAnalyst,
  },
  {
    title: "WHY SHOULD I REGISTER FOR A COURSE WHEN I CAN SELF LEARN?",
    author: "Arowolo Ayoola PhD.",
    authorImgSrc: "/assets/our-team/Doc.png",
    date: "May 16th 2022",
    route: routes.blogWhyRegisterCourse,
    component: WhyShouldIRegister,
  },
];
export default function blogRouter() {
  return (
    <>
      <Route path={routes.blog} element={<Blog blogInfos={blogInfos} />} />
      {blogInfos.map((v, _) => {
        return (
          <Route
            path={v.route}
            element={
              <BlogPost
                title={v.title}
                author={v.author}
                authorImgSrc={v.authorImgSrc}
                date={v.date}
              >
                <v.component />
              </BlogPost>
            }
          />
        );
      })}
    </>
  );
}
