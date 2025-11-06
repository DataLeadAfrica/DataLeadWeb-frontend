import { Route } from "react-router";
import { routes } from "../routes";
import Consultancy from "./page.tsx";

export default function consultancyRoutes() {
  return (
    <>
      <Route
        path={routes.consultancy}
        element={
          <Consultancy
            firstTitle="Data-Driven Solutions for Business Success"
            firstDesc="We specialize in research, monitoring, and evaluation (M&E), assessments, strategic planning, capacity building, and policy analysis. Whether it’s conducting a baseline survey, implementing a complex mixed-method evaluation, or advising on inclusive strategies, our team of experienced consultants brings both technical expertise and contextual understanding to every engagement."
            firstImg="/assets/consultancy/consultancy.png"
            secondTitle="Your Full-Service Partner for Program Effectiveness"
            secondDesc="At Data-Lead Africa, we provide high-quality, evidence-based consultancy services across diverse sectors, including health, agriculture, education, water, sanitation and hygiene (WASH), nutrition, social protection, climate resilience, gender equality, disability inclusion, economic development, humanitarian response, and governance, and more. Our consultancy offerings are tailored to support organizations, governments, and development partners in making informed decisions that drive sustainable impact."
            thirdTitle="What We Offer"
            thirdDesc="Our work is guided by a commitment to rigor, inclusivity, and local ownership, ensuring that our clients receive actionable insights grounded in evidence and shaped by the communities they aim to serve."
            thirdEntries={[
              "Baseline, midline, and endline evaluations",
              "Formative and operational research",
              "Needs assessments and feasibility studies",
              "Mixed-method research design and implementation",
              "Monitoring and Evaluation frameworks and tools",
              "Policy and program analysis",
              "Capacity building for research and M&E systems",
              "Stakeholder mapping and community engagement strategies",
            ]}
            fifthTitle="Let’s work together to turn data into action."
          />
        }
      />
      <Route
        path={routes.training}
        element={
          <Consultancy
            firstTitle="Building Capacity for a Brighter Future"
            firstDesc="Data-Lead Africa offers fully customized, organization-specific training programs to empower your team. We develop training solutions across sectors, designing each program to align with your industry, objectives, and team dynamics. These services are available to NGOs, government agencies, private enterprises, and multilateral institutions. No matter your organization's sector, our expert facilitators collaborate with your team to craft a program that addresses your unique challenges and goals."
            firstImg="/assets/consultancy/training.png"
            secondTitle="Strengthening Organizations Through Effective Training"
            secondDesc="Our training programs are designed to create a lasting impact within your organization. By building internal capacity through practical, hands-on learning, we help your team improve service delivery and make more informed decisions. Each course emphasizes real-world exercises and case studies, so participants can immediately apply new skills to their daily work. This outcome-focused approach strengthens individual competencies and equips your organization to innovate and tackle challenges effectively."
            thirdTitle="Program Areas"
            thirdDesc="Our consultancy training covers a wide range of technical and professional skill areas, including:"
            thirdEntries={[
              "Data Analytics: Foundations to advanced techniques using tools like Excel, Power BI, SQL, Tableau, SAS, Nvivo, QDA Miner, Atlas.ti, Dedoose, Python, and R",
              "Geospatial Tools: Training on GIS, remote sensing, and spatial analysis for development and planning",
              "Research Methodology: Design and implementation of qualitative, quantitative, and mixed-methods studies",
              "Manuscript Writing: Academic and technical writing for journal publication, reports, and evidence dissemination",
              "Grant and Proposal Writing: Developing compelling, fundable proposals for research and development projects",
              "Monitoring & Evaluation (M&E): Designing M&E systems, logframes, indicators, and data use for program improvement",
              "Report Writing: Communicating findings clearly through professional and policy-relevant reports",
              "Sign Language: Promoting workplace inclusion and communication for Deaf staff and clients",
              "Policy Development & Advocacy: Crafting evidence-informed policies and strategies to influence change",
              "Entrepreneurship & Innovation: Business development, strategic thinking, and pitching skills for startup and enterprise growth",
              "Leadership & Professional Development: Building soft skills, team management, and ethical leadership",
            ]}
            fifthTitle="Let’s build your team’s capacity, co-create a training that meets your organization’s needs."
          />
        }
      />
    </>
  );
}
