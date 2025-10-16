import { Route } from "react-router";
import Research from "../pages/Research";
import { routes } from "../routes";

export default function researchRoutes() {
  return (
    <>
      <Route
        path={routes.researchNigeriaJointResponse}
        element={
          <Research
            imgSrc="/assets/research/NJR.png"
            title="NIGERIA JOINT RESPONSE/DUTCH MINISTRY OF FOREIGN AFFAIRS (Oct – Nov 2020)"
            projTitle="Accountability pilot survey in Borno state"
            desc="We played a key role in the “Accountability Pilot” survey, an M&E project in Borno State, Nigeria. This project aimed to improve accountability by testing new ways to gather feedback from communities.  These methods included voice recorders and dedicated staff presence to collect complaints, provide information (help desk), and address concerns. As the M&E Officer and Data Analyst, we trained enumerators and oversaw data collection across three districts (Dikwa, Mafa, Mongonu) and analyzed data from focus groups (FGDs) and key informant interviews (KIIs) to identify themes then we delivered reports with findings and recommendations to inform stakeholders on the project’s effectiveness and long-term viability."
          />
        }
      />
      <Route
        path={routes.researchUsaidNigeria}
        element={
          <Research
            imgSrc="/assets/research/USAID.png"
            title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
            projTitle="Northern Education Initiative Plus (NEI+)"
            desc="We contributed to the Northern Education Initiative Plus (NEI+), a USAID-funded project aiming to improve access to quality education and reading skills for over a million children in underserved communities (girls, orphans, and those in non-traditional schools) across Bauchi and Sokoto states in Nigeria. This was achieved through concise research on existing assessments and data collection methods, ensuring the project leveraged best practices. We also programmed the data collection tool to be compatible with data analysis software, streamlining the process. We efficiently managed the data coming in daily from a large team of interviewers spread across three states. By collaborating on daily data analysis, we prevented backlogs. Finally, we analyzed qualitative data to identify key themes that informed the project’s overall findings."
          />
        }
      />
      <Route
        path={routes.researchMercyCorps}
        element={
          <Research
            imgSrc="/assets/research/Mercy-corps.png"
            title="MERCY CORPS (Mar – Apr 2021)"
            projTitle="Humanitarian assistance, Livelihood, Food Security"
            desc="The REACH 4 project aimed to improve food security for over 13,500 conflict-affected families in Damboa, Borno, over a one-year period. Here’s what you contributed. To achieve this we trained and supervised 18 enumerators for data collection in 8 project communities and also ensured data quality by implementing Data Quality Assurance measures. We collaborated on the evaluation report and presented findings to Mercy Corps."
          />
        }
      />
      <Route
        path={routes.researchJapanInternational}
        element={
          <Research
            imgSrc="/assets/research/JICA.jpg"
            title="Japan International Cooperation Agency (Oct – Nov 2021)"
            projTitle="Promotion of Market-Oriented Agricultural Extension System for Livelihood Improvement in Nigeria (SHEP Nigeria)"
            desc="Our brief tenure (October 10th – November 9th, 2021) as a data analyst for JICA’s SHEP Nigeria project in Edo State proved highly impactful. Through data analysis of agricultural production, market trends, and farmer demographics, we identified crucial links between market-oriented extension systems and improved livelihoods. Clear visualizations and collaboration with project experts transformed data into actionable insights, driving informed decision-making, resource allocation, and impactful reports. This ultimately supported data-driven strategies that propelled the project’s success and fostered sustainable agricultural growth in Edo State."
          />
        }
      />
      <Route
        path={routes.researchSocialImpactUsaid}
        element={
          <Research
            imgSrc="/assets/research/social-impact-usaid.jpg"
            title="SOCIAL IMPACT/USAID NIGERIA (Dec 2021 – Feb 2022)"
            projTitle="USAID Agribusiness Investment Midterm Performance Evaluation"
            desc="We played a vital role in the USAID Agribusiness Investment Midterm Performance Evaluation. During December 2021 to January 2022, we analyzed project data (both quantitative and qualitative) using advanced techniques. This analysis yielded key trends and insights that contributed to the evaluation report. Our work with the team ensured a data-driven understanding of the project’s national impact, progress, and areas for improvement.  By helping present findings and supporting adjustments, you ultimately contributed to the project’s success and positive impact on Nigeria’s agribusiness sector."
          />
        }
      />
      <Route
        path={routes.researchNigeriaViolenceUsaid}
        element={
          <Research
            imgSrc="/assets/researches/nigeria-violence-usaid.png"
            title="FINAL ASSESSMENT REPORT USAID/NIGERIA VIOLENCE AND CONFLICT ASSESSMENT (VCA)"
            projTitle="December 2024"
            desc="This assessment was conducted under the Peacebuilding Evaluation, Analysis, Research, and Learning (PEARL) Activity, funded by the United States Agency for International Development (USAID). It was implemented by Social Impact, Inc. in partnership with Integrity Global, Inc. and Data-Lead Africa.

The report provides one of the most comprehensive recent analyses of Nigeria’s conflict landscape, combining national and sub-national perspectives to inform USAID’s next Country Development Cooperation Strategy (CDCS).
Drawing on data from 18 states and the Federal Capital Territory, the assessment integrates quantitative and qualitative insights from over 900 survey respondents and 64 key informant interviews. It maps the underlying drivers of conflict, identifies key actors and hotspots, and explores how economic, political, and environmental pressures intersect to shape Nigeria’s security environment."
          report="/assets/researches/Nigeria VCA Final Report - b10d69fa-25d5-4c89-b9b8-b20259de6c83.pdf"
          />
        }
      />
    </>
  );
}
