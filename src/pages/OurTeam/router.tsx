import { Route } from "react-router";

import { routes } from "../routes";

import OurTeam from "./page";
import Bio from "./Bio/page";

export type StaffInfo = Record<
  string,
  {
    name: string;
    title: string;
    imgSrc: string;
    bioRoute: string;
    bioText: string;
    lead?: boolean;
    leadBio?: string;
    expertise?: string;
    institutions?: string[];
  }
>;

const staffInfo: StaffInfo = {
  Doc: {
    name: "Arowolo Ayoola, Ph.D",
    title: "Lead Partner and Founder",
    imgSrc: "/assets/our-team/arowolo-lead.jpg",
    bioRoute: routes.ourTeamDrAyo,
    lead: true,
    leadBio:
      "A researcher, data analyst and monitoring & evaluation consultant with nearly two decades of experience shaping high-impact policy and research, including working on the Nigeria's Economic Recovery & Growth Plan. Founder of Deaf-in-Tech and World Economic Forum Social Intrapreneur of the Year 2023.",
    institutions: ["World Bank", "USAID", "FCDO", "GIZ", "R4D", "AGRA"],
    bioText: `Dr. Arowolo Ayoola is a researcher, data analyst, monitoring and evaluation consultant, and health financing expert. With a profound commitment to diversity, equity, and inclusion, he is a passionate advocate for gender, disability, and social inclusion. Dr. Arowolo is the founder of Deaf-in-Tech and co-founder of Data-Lead Africa, where he is dedicated to leveraging data for transformative change and promoting inclusivity in the tech sector.

At Data-Lead Africa, Dr. Arowolo plays a pivotal role in driving strategic decision-making and organizational success through data analytics. His groundbreaking Deaf-in-Tech project equips individuals with disabilities for success in the tech industry, earning him recognition as a World Economic Forum Social Intrapreneur of the Year 2023.

Dr. Arowolo has about 2 decade of cognate experience leading high-impact projects, including shaping the National Economic Recovery Growth Plan (ERGP) for Nigeria and leading on several research initiatives funded by institutions such as FCDO, USAID, GIZ, R4D, RTI, AGRA, ADB, and the World Bank. His ability to translate complex data into actionable insights has made him a sought-after consultant in his field.

Before his current roles, Dr. Arowolo began his career as a Fleet Safety Engineer with Tales Oil and Gas. where, he conducted technical safety audits of petroleum haulage trucks, developed dashboards for monitoring fleet safety status and continually monitors the impact of fleet policies and projects on health and safety of personnel and the environment.

He speaks fluently in English, sign language (ASL) and the three Nigerian Languages (Hausa, Igbo and Yoruba)

Dr Arowolo is also a member of the Board of Advisors at Genius Business School Abuja. He is highly dedicated to mentoring, which is evident in his work with over 100 entrepreneurs in Lagos, Edo, and Abuja under the GIZ Entrepreneurship Cycle (E-Cycle) program, and as a Westerwelle Entrepreneurship Mentor for startups in East Africa.

Dr. Arowolo’s unwavering commitment to data-driven solutions and inclusive development strategies positions him as a leading figure in shaping a more equitable and prosperous future for all. He holds a Ph.D. in Industrial Technical Education (Automobile) from the University of Nigeria, Nsukka.`,
  },
  Abdul: {
    name: "Abdulsalam Oluwatosin, Ph.D",
    title: "Senior Partner and Co-Founder",
    imgSrc: "/assets/our-team/abdulsalam-light.jpg",
    bioRoute: routes.ourTeamAbdul,
    expertise: "Bioinformatics and data science, computational genomics",
    bioText: `Abdulsalam Oluwatosin is the Senior Partner and Co-Founder of Data-Lead Africa. He is a bioinformatics and data science expert with over eight years of experience in computational genomics and working with NGS data. Abdulsalam has a comprehensive background in developing and implementing computational methods and workflows to analyze high-throughput genomic data. Proficient in Python, SQL, R, and Shell scripting, he is also competent in working in Linux environments and HPC computing.

Abdulsalam’s research expertise lies in population genetics, with prior experience in applied bioinformatics in plant genetics. He holds a Doctor of Philosophy (Ph.D.) in Bioinformatics from UNSW, a Master’s Degree in Computer Science/Bioinformatics from the University of Ibadan, and a Postgraduate Diploma in Agronomy and Crop Science from Ladoke Akintola University of Technology. He also holds a Bachelor’s Degree in Agricultural Engineering from Ladoke Akintola University of Technology.

Before co-founding Data-Lead Africa, Abdulsalam worked as a Bioinformatics Research Supervisor at the International Institute of Tropical Agriculture (IITA) in Ibadan, Nigeria, where he applied statistical and computational methods to analyze large-scale biological data and developed pipelines to automate established analyses. He also served as an HDR Representative on the UNSW Academic Board, providing advice on academic policy, strategy, and standards. Additionally, Abdulsalam was an eResearch Trainer at Intersect Australia, where he taught R programming and machine learning.

Abdulsalam has a lifelong personal interest in supporting equitable health access for the community by applying bioinformatics methods. His skills include genomics data analysis, bioinformatics software development, and the use of various bioinformatics tools and software such as GATK, bcftools, samtools, and more. His commitment to advancing bioinformatics and data science has made significant contributions to the field and continues to drive the mission of Data-Lead Africa.`,
  },
  Sefunmi: {
    name: "Sefunmi Oluwole",
    title: "DEI, Partnerships & Programs Manager",
    imgSrc: "/assets/our-team/sefunmi-light.jpg",
    bioRoute: routes.ourTeamSefunmi,
    expertise: "Public health, humanitarian programming, policy",
    bioText: `Sefunmi Oluwole is the DEI Partnerships, Advocacy, Policy Strengthening, and Program Development Manager at Data-Lead Africa. She is also the co-founder of the Data-Lead Africa Foundation, where she leads initiatives to strengthen and bridge the economic gap for marginalized communities and groups.

A public health professional, Sefunmi has extensive experience in donor program management and the implementation of humanitarian aid, humanitarian coordination, risk and program analysis, infection control, and ethical clinical research. Her expertise spans AMR, HPV and cervical cancer, clinical trials, monitoring and evaluation, program planning and development, and curriculum development in reproductive, maternal, adolescent, and infant health in low-and-middle-income countries.

At Data-Lead Africa, Sefunmi plays a pivotal role in driving DEI initiatives, advocating for policy strengthening, and developing programs that promote inclusivity. She leverages her experience to ensure that marginalized communities have access to opportunities and resources that foster growth and development.

Sefunmi holds a B.Sc. in Microbiology from the University of Jos and a Postgraduate Certificate in Infectious Disease Epidemiology from Bayero University, Kano, where she graduated with distinction.

Before joining Data-Lead Africa, Sefunmi served as a National Program Officer for Humanitarian Aid at the Embassy of Switzerland in Nigeria. In this role, she planned funds allocation for humanitarian aid projects in North East Nigeria, designed priority projects, and provided technical support to partners, ensuring compliance with humanitarian principles. She also worked with the United Nations OCHA as the NE Coordination Focal Point for Women-Led Organizations, mentoring women-led CSOs/NNGOs, advocating for localization of humanitarian responses, and providing training and capacity-building support.

Additionally, Sefunmi has experience as a Program Officer at the Women’s Refugee Commission, where she implemented projects to improve reproductive, maternal, newborn, child, adolescent health, and nutrition in fragile communities. She also worked as a Clinical Research Associate at the Institute of Human Virology Nigeria, contributing to US-NIH funded research projects.

Sefunmi’s dedication to public health and her commitment to bridging economic gaps for marginalized communities make her a vital asset to Data-Lead Africa.’`,
  },
  Felicia: {
    name: "Felicia Ayodele",
    title: "Chief Operating Officer",
    imgSrc: "/assets/our-team/felicia-light.jpg",
    bioRoute: routes.ourTeamFelicia,
    expertise: "Operations, communications and organisational strategy",
    bioText: `Felicia Oborotomu Ayodele is the Chief Operating Officer of Data-Lead Africa, where she oversees the organization's daily operations and supports the successful delivery of projects and organizational goals. With over a decade of experience in communications, management, and team leadership, she has played an important role in the growth and development of the organization.

Felicia began her career as a content creator at Data-Lead Africa, rising through the ranks to become the head of communications. Her unique blend of creativity, strategic thinking, and analytical insight has earned her a proven track record of leading teams, collaborating with multicultural stakeholders, and delivering impactful results.

In addition to her professional achievements, Felicia is committed to giving back to the community. She provides employability and entrepreneurship training and mentorship to over 150 young people in Nigeria, empowering them to discover their potential.

Felicia’s warm and engaging approach has built her a reputation as a trusted brand advisor, creative content genius, and passionate advocate for innovation and growth. Before joining Data-Lead Africa, she worked as a field journalist with the Nigerian Television Authority in Zaria.`,
  },
  Matthew: {
    name: "Gabriel Matthew",
    title: "Head of Communications",
    imgSrc: "/assets/our-team/gabriel-light.jpg",
    bioRoute: routes.ourTeamMatthew,
    expertise: "Brand, media and creative direction",
    bioText: `I'm Gabriel Mathew, a multidisciplinary creative and Visual Storyteller. I currently serve as the Graphics Manager at Data-Lead Africa, where I lead the visual strategy within the Communications Department.I wear many hats, as a Director, Graphic Designer, Visual Content Curator, and Photographer — and I’m passionate about turning ideas into compelling visuals. Whether I’m behind the lens or designing behind the screen, I focus on creating content that connects, inspires, and drives impact.`,
  },
};

export default function ourTeamRouter() {
  return (
    <>
      <Route
        path={routes.ourTeam}
        element={<OurTeam staffInfo={staffInfo} />}
      />
      {Object.entries(staffInfo).map(([k, v]) => {
        return (
          <Route
            key={k}
            path={v.bioRoute}
            element={
              <Bio
                imgSrc={v.imgSrc}
                name={v.name}
                title={v.title}
                text={v.bioText}
              />
            }
          />
        );
      })}
    </>
  );
}
