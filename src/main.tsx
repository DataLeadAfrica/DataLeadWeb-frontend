import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import "./global.css";
import Footer from "./components/Footer";
import Header from "./components/Header";
import Index from "./Index";
import Blog from "./pages/Blog";
import Researches from "./pages/Researches";
import WhoWeAre from "./pages/WhoWeAre";
import ContactUs from "./pages/ContactUs";
import OurTeam from "./pages/OurTeam";
import Courses from "./pages/Courses";
import DataAnalytics from "./pages/bootcamps/DataAnalytics";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import ScrollToTop from "./components/ScrollToTop";
import Bio from "./pages/Bio";
import Research from "./pages/Research";
import BlogPost from "./pages/BlogPost";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="*" element={<NotFound />} />
        <Route path="/" element={<Index />} />
        <Route path="/blog" element={<Blog />} />
        <Route
          path="/blog/why-should-i-register-for-a-course-when-i-can-self-learn"
          element={
            <BlogPost
              title="WHY SHOULD I REGISTER FOR A COURSE WHEN I CAN SELF LEARN?"
              date="May 16th 2022"
              imgSrc="/assets/blog/temp.svg"
              content="“Get into tech, that is one of the ways to make money” I am sure you’ve heard this a lot of times especially on social media and with everyone wanting to update their bios with the tag “tech bro”.
Technology isn’t just the way of the future, it’s the way of right now! Having been adopted in all sorts of different industries, you’ll now find people talking constantly talking about developing tech skills to remain relevant in the world. Also, information is now readily accessible to any and every one through the use of the internet. Pretty sure, you have heard a lot of people even your friends talk about delving into tech. For you, the problem might be where to begin and you have decided to go on youtube to watch and replicate the processes. This process is known as “self-learning”.
Self-learning is an approach to learning where the individual makes the effort to identify their own learning needs, set learning goals, find the necessary resources, and evaluate their own knowledge. (Source: Wikipedia)
With such a boom in the use of technology, having the skills required to work in tech isn’t just valuable – it’s all but a necessity.
You may have also heard that many of history’s greatest scientists, inventors and artists were self-taught. Leonardo da Vinci taught himself engineering. The Wright brothers never graduated high school. Henry Ford never attended college.

There is no doubt about it, self-learning has some advantages, however, we can’t fail to acknowledge some of its drawbacks too. With so much information and resources available on the internet, you discover this information can be too voluminous and quite confusing giving you a barrage of choices. Why then should bother registering for a course when you can easily self-learn?

1. Specific learning

Knowing what to learn when starting a career in tech can be a challenge especially if you are just beginning. For instance, if you want to delve into data analytics, you will be faced with questions like what software should I begin with? Which documents should I read? Which course should I complete? What is going to be relevant to the organization I want to work with?
Registering for a course with us here at Data-Lead Africa saves you all these worries. Our three months Applied Data Analytics Bootcamp takes you through a journey and everything you need to kickstart a career in data analytics. You will learn the basics which will begin with the process of data collection, building a questionnaire from scratch and the important research questions to ask. After which, you will learn different data analysis tools for analyzing the data collected, be it quantitative (numeric data) or qualitative (non-numeric data) data. The final process is the data visualization stage where you will learn how to create reports, dashboards and interactive visuals which display the insights for better decision making.

2. More engaging and Facilitator driven

With self-learning, you will get to learn from pre-recorded videos hence there is no facilitator to guide you to ease the learning process and make learning faster. There is also little or no room for asking questions from the facilitator to gain clarity on any area that is unclear.
When you register for a course with us, classes are intensive and more engaging as participants get to contribute and also get prompt answers from the facilitator handling the session.

3. Network and join a community

Getting to interact with others while learning has proved to be an effective method of learning. It also gives you an experience and an avenue to be a part of a community of people with the same interests and same passion as well as the same field. You get to share experiences and also assist each other in the learning process. Building relationships is also a vital part of human existence and you may not have access to this when self-learning via the internet.

4. Targeted learning approach

There are a lot of readily available resources on the internet which can be overwhelming and distracting especially as a beginner as you might not know which course to begin with. Hence this can pose a barrier and hamper the learning process. Registering for a course will allow you to take courses one step at a time and follow the schedule as given by the institute or schedule given by the organization which makes it easier for one to follow through till the end.

5. Faster learning process and limited mistakes

Mistakes are inevitable and also part of the learning process, however, mistakes can be limited when you are in a class where the facilitator is easily accessible to guide you and effectively correct mistakes that will be made during the cause of learning which makes learning faster and easier.
Here at Data-Lead Africa, we have a range of services such as the Applied Data Analytics Bootcamp which is designed to make learning how to work with data easier. Get in touch with us today to find out more"
            />
          }
        />
        <Route path="/research" element={<Researches />} />
        <Route
          path="/research/usaid-nigeria-dec-2020-jan-2021"
          element={
            <Research
              imgSrc="/assets/research/USAID.png"
              title="USAID/NIGERIA (Dec 2020 – Jan 2021)"
              category="Education development"
              desc="Northern Education Initiative Plus (NEI+) We contributed to the Northern Education Initiative Plus (NEI+), a USAID-funded project aiming to improve access to quality education and reading skills for over a million children in underserved communities (girls, orphans, and those in non-traditional schools) across Bauchi and Sokoto states in Nigeria. This was achieved through concise research on existing assessments and data collection methods, ensuring the project leveraged best practices. We also programmed the data collection tool to be compatible with data analysis software, streamlining the process. We efficiently managed the data coming in daily from a large team of interviewers spread across three states. By collaborating on daily data analysis, we prevented backlogs. Finally, we analyzed qualitative data to identify key themes that informed the project’s overall findings."
            />
          }
        />
        <Route path="/who-we-are" element={<WhoWeAre />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/our-team" element={<OurTeam />} />
        <Route path="/courses" element={<Courses />} />
        <Route
          path="/courses/data-analytics-bootcamp"
          element={<DataAnalytics />}
        />
        {/* Management */}
        <Route
          path="/our-team/dr-arowolo-ayoola"
          element={
            <Bio
              imgSrc="/assets/our-team/Doc.png"
              name="Dr. Arowolo Ayoola"
              text="Dr. Arowolo Ayoola is a researcher, data analyst, monitoring and evaluation consultant, and health financing expert. With a profound commitment to diversity, equity, and inclusion, he is a passionate advocate for gender, disability, and social inclusion. Dr. Arowolo is the founder of Deaf-in-Tech and co-founder of Data-Lead Africa, where he is dedicated to leveraging data for transformative change and promoting inclusivity in the tech sector.

At Data-Lead Africa, Dr. Arowolo plays a pivotal role in driving strategic decision-making and organizational success through data analytics. His groundbreaking Deaf-in-Tech project equips individuals with disabilities for success in the tech industry, earning him recognition as a World Economic Forum Social Intrapreneur of the Year 2023.

Dr. Arowolo has about 2 decade of cognate experience leading high-impact projects, including shaping the National Economic Recovery Growth Plan (ERGP) for Nigeria and leading on several research initiatives funded by institutions such as FCDO, USAID, GIZ, R4D, RTI, AGRA, ADB, and the World Bank. His ability to translate complex data into actionable insights has made him a sought-after consultant in his field.

Before his current roles, Dr. Arowolo began his career as a Fleet Safety Engineer with Tales Oil and Gas. where, he conducted technical safety audits of petroleum haulage trucks, developed dashboards for monitoring fleet safety status and continually monitors the impact of fleet policies and projects on health and safety of personnel and the environment.

He speaks fluently in English, sign language (ASL) and the three Nigerian Languages (Hausa, Igbo and Yoruba)

Dr Arowolo is also a member of the Board of Advisors at Genius Business School Abuja. He is highly dedicated to mentoring, which is evident in his work with over 100 entrepreneurs in Lagos, Edo, and Abuja under the GIZ Entrepreneurship Cycle (E-Cycle) program, and as a Westerwelle Entrepreneurship Mentor for startups in East Africa.

Dr. Arowolo’s unwavering commitment to data-driven solutions and inclusive development strategies positions him as a leading figure in shaping a more equitable and prosperous future for all. He holds a Ph.D. in Industrial Technical Education (Automobile) from the University of Nigeria, Nsukka."
            />
          }
        />
        <Route
          path="/our-team/abdulsalam-oluwatosin"
          element={
            <Bio
              imgSrc="/assets/our-team/Abdulsalam.png"
              name="Abdulsalam Oluwatosin"
              text="Abdulsalam Oluwatosin is the Senior Partner and Co-Founder of Data-Lead Africa. He is a bioinformatics and data science expert with over eight years of experience in computational genomics and working with NGS data. Abdulsalam has a comprehensive background in developing and implementing computational methods and workflows to analyze high-throughput genomic data. Proficient in Python, SQL, R, and Shell scripting, he is also competent in working in Linux environments and HPC computing.

Abdulsalam’s research expertise lies in population genetics, with prior experience in applied bioinformatics in plant genetics. He holds a Doctor of Philosophy (Ph.D.) in Bioinformatics from UNSW, a Master’s Degree in Computer Science/Bioinformatics from the University of Ibadan, and a Postgraduate Diploma in Agronomy and Crop Science from Ladoke Akintola University of Technology. He also holds a Bachelor’s Degree in Agricultural Engineering from Ladoke Akintola University of Technology.

Before co-founding Data-Lead Africa, Abdulsalam worked as a Bioinformatics Research Supervisor at the International Institute of Tropical Agriculture (IITA) in Ibadan, Nigeria, where he applied statistical and computational methods to analyze large-scale biological data and developed pipelines to automate established analyses. He also served as an HDR Representative on the UNSW Academic Board, providing advice on academic policy, strategy, and standards. Additionally, Abdulsalam was an eResearch Trainer at Intersect Australia, where he taught R programming and machine learning.

Abdulsalam has a lifelong personal interest in supporting equitable health access for the community by applying bioinformatics methods. His skills include genomics data analysis, bioinformatics software development, and the use of various bioinformatics tools and software such as GATK, bcftools, samtools, and more. His commitment to advancing bioinformatics and data science has made significant contributions to the field and continues to drive the mission of Data-Lead Africa."
            />
          }
        />
        <Route
          path="/our-team/sefunmi-oluwole"
          element={
            <Bio
              imgSrc="/assets/our-team/Sefunmi.png"
              name="Sefunmi Oluwole"
              text="Sefunmi Oluwole is the DEI Partnerships, Advocacy, Policy Strengthening, and Program Development Manager at Data-Lead Africa. She is also the co-founder of the Data-Lead Africa Foundation, where she leads initiatives to strengthen and bridge the economic gap for marginalized communities and groups.

A public health professional, Sefunmi has extensive experience in donor program management and the implementation of humanitarian aid, humanitarian coordination, risk and program analysis, infection control, and ethical clinical research. Her expertise spans AMR, HPV and cervical cancer, clinical trials, monitoring and evaluation, program planning and development, and curriculum development in reproductive, maternal, adolescent, and infant health in low-and-middle-income countries.

At Data-Lead Africa, Sefunmi plays a pivotal role in driving DEI initiatives, advocating for policy strengthening, and developing programs that promote inclusivity. She leverages her experience to ensure that marginalized communities have access to opportunities and resources that foster growth and development.

Sefunmi holds a B.Sc. in Microbiology from the University of Jos and a Postgraduate Certificate in Infectious Disease Epidemiology from Bayero University, Kano, where she graduated with distinction.

Before joining Data-Lead Africa, Sefunmi served as a National Program Officer for Humanitarian Aid at the Embassy of Switzerland in Nigeria. In this role, she planned funds allocation for humanitarian aid projects in North East Nigeria, designed priority projects, and provided technical support to partners, ensuring compliance with humanitarian principles. She also worked with the United Nations OCHA as the NE Coordination Focal Point for Women-Led Organizations, mentoring women-led CSOs/NNGOs, advocating for localization of humanitarian responses, and providing training and capacity-building support.

Additionally, Sefunmi has experience as a Program Officer at the Women’s Refugee Commission, where she implemented projects to improve reproductive, maternal, newborn, child, adolescent health, and nutrition in fragile communities. She also worked as a Clinical Research Associate at the Institute of Human Virology Nigeria, contributing to US-NIH funded research projects.

Sefunmi’s dedication to public health and her commitment to bridging economic gaps for marginalized communities make her a vital asset to Data-Lead Africa.’"
            />
          }
        />
        {/* Programs */}
        <Route
          path="/our-team/oche-loveth"
          element={
            <Bio
              imgSrc="/assets/our-team/Loveth.png"
              name="Oche Loveth"
              text="Loveth Oche is a Programme Officer at Data-Lead Africa, with extensive experience in grant and proposal writing, data collection and database management. Her expertise in these areas drives impactful, data-driven initiatives across public health, WASH (Water, Sanitation, and Hygiene), and DEI (Diversity, Equity, and Inclusion) projects.

At Data-Lead Africa, Loveth plays a critical role in overseeing multiple projects, ensuring smooth operations through her organizational skills and the ability to multitask effectively. She is an advocate for continuous learning and improvement, fostering collaboration and knowledge-sharing among her team to enhance project outcomes.

Loveth’s experience spans various high-impact projects for USAID and FCDO funded projects. In public health, she has led initiatives focused on improving community health outcomes through data-driven strategies. Her work in WASH has involved developing and implementing programs that promote access to clean water and sanitation, directly impacting community health and well-being.
Before joining Data-Lead Africa, Loveth worked with the Nigerian Christian Pilgrim Board where as an administrative officer.

Loveth holds a Bachelor of Science in Anatomy from Bingham University and a Master of Public Health from Nile University, Abuja. Her academic background and commitment to continuous professional development are evident in her pursuit of advanced training and certifications in project management and data analysis.

Born and raised in Nigeria, Loveth is fluent in English and brings a deep understanding of the local context to her work. Her dedication to improving community health and promoting inclusion through data-driven approaches makes her an invaluable asset to Data-Lead Africa."
            />
          }
        />
        {/* Communications */}
        <Route
          path="/our-team/felicia-ayodele"
          element={
            <Bio
              imgSrc="/assets/our-team/Felicia.png"
              name="Felicia Ayodele"
              text="Felicia Oborotomu Ayodele leads the communications department at Data-Lead Africa, bringing over a decade of progressive experience in branding and communications. As a creative and strategic brand storyteller, she crafts compelling narratives that captivate audiences and drive results.

Felicia began her career as a content creator at Data-Lead Africa, rising through the ranks to become the head of communications. Her unique blend of creativity, strategic thinking, and analytical insight has earned her a proven track record of leading teams, collaborating with multicultural stakeholders, and delivering impactful results.

In addition to her professional achievements, Felicia is committed to giving back to the community. She provides employability and entrepreneurship training and mentorship to over 150 young people in Nigeria, empowering them to discover their potential.

Felicia’s warm and engaging approach has built her a reputation as a trusted brand advisor, creative content genius, and passionate advocate for innovation and growth. Before joining Data-Lead Africa, she worked as a field journalist with the Nigerian Television Authority in Zaria."
            />
          }
        />
        <Route
          path="/our-team/maranatha-emmaogboji"
          element={
            <Bio
              imgSrc="/assets/our-team/Maranatha.png"
              name="Maranatha Emmaogboji"
              text="Maranatha is a storyteller and data analyst working as an expert in media, education, and interdisciplinary research. At Data-Lead Africa, he leads strategic communications while designing and delivering data analytics training focused on education and technology. His work also incorporates visual storytelling, writing, and design that creates impactful social discourse."
            />
          }
        />
        // Not finished pages
        <Route
          path="/courses/short-courses"
          element={<ComingSoon name="short courses" />}
        />
      </Routes>
      <Footer />
    </BrowserRouter>
  </StrictMode>,
);
