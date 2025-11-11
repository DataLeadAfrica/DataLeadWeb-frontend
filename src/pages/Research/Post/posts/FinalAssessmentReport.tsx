import report from "../assets/Nigeria VCA Final Report - b10d69fa-25d5-4c89-b9b8-b20259de6c83.pdf";

export default function FinalAssessmentReport() {
  return (
    <>
      <p>
        This assessment was conducted under the Peacebuilding Evaluation,
        Analysis, Research, and Learning (PEARL) Activity, funded by the United
        States Agency for International Development (USAID). It was implemented
        by Social Impact, Inc. in partnership with Integrity Global, Inc. and
        Data-Lead Africa.,
      </p>
      <p>
        The report provides one of the most comprehensive recent analyses of
        Nigeria’s conflict landscape, combining national and sub-national
        perspectives to inform USAID’s next Country Development Cooperation
        Strategy (CDCS). Drawing on data from 18 states and the Federal Capital
        Territory, the assessment integrates quantitative and qualitative
        insights from over 900 survey respondents and 64 key informant
        interviews. It maps the underlying drivers of conflict, identifies key
        actors and hotspots, and explores how economic, political, and
        environmental pressures intersect to shape Nigeria’s security
        environment.
      </p>
      <a
        style={{ marginTop: "1rem" }}
        className="btn"
        download={true}
        href={report}
      >
        Download the report
      </a>
    </>
  );
}
