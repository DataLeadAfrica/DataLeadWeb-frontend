import { Route } from "react-router";
import BlogPost from "../pages/BlogPost";
import { routes } from "../routes";
import Top7DataAnalytics from "../pages/blogs/Top7DataAnalytics";
import HowNYSCMembersCan from "../pages/blogs/HowNYSCMembersCan";
import FromBeginnerToAnalyst from "../pages/blogs/FromBeginnerToAnalyst";
import ExcelVsPowerBI from "../pages/blogs/ExcelVsPowerBI";
import SQLForBeginners from "../pages/blogs/SQLForBeginners";
import DrivingInclusionWithData from "../pages/blogs/DrivingInclusionWithData";

export default function blogRoutes() {
  return (
    <>
      <Route
        path={routes.blogWhyRegisterCourse}
        element={
          <BlogPost
            title="WHY SHOULD I REGISTER FOR A COURSE WHEN I CAN SELF LEARN?"
            author="Arowolo Ayoola PhD."
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
      <Route
        path={routes.blogTop7DataAnalytics}
        element={<Top7DataAnalytics />}
      />
      <Route
        path={routes.blogHowNYSCMembersCan}
        element={<HowNYSCMembersCan />}
      />
      <Route
        path={routes.blogFromBeginnerToAnalyst}
        element={<FromBeginnerToAnalyst />}
      />
      <Route path={routes.blogExcelVsPowerBI} element={<ExcelVsPowerBI />} />
      <Route path={routes.blogSQLForBeginners} element={<SQLForBeginners />} />
      <Route
        path={routes.blogDrivingInclusionWithData}
        element={<DrivingInclusionWithData />}
      />
    </>
  );
}
