import { Link } from "react-router";
import "../css/our-team.css";
import Card from "../components/Card";

function TeamMember({
  imgLink,
  name,
  title,
  bioLink,
}: {
  imgLink: string;
  name: string;
  title: string;
  bioLink: string;
}) {
  return (
    <Card>
      <div className="our-team__member">
        <div className="member__image">
          <img src={imgLink} alt="" />
        </div>
        <div className="member__info">
          <h3>{name}</h3>
          <p>{title}</p>
          <Link to={bioLink} className="btn btn-transparent">
            Read Bio
          </Link>
        </div>
      </div>
    </Card>
  );
}

// NOTE: Ask about image sizes
export default function OurTeam() {
  return (
    <div className="our-team__page">
      <div className="our-team__heading">
        <h1>Meet the Data-Lead Africa Team</h1>
        <h2>
          The Data-Lead Africa team is a diverse group of passionate and
          talented individuals dedicated to driving positive change across
          Africa.
        </h2>
      </div>
      <div className="our-team__members">
        <div className="members__wrapper">
          <h3>
            <div className="title-bar" />
            Management
            <div className="title-bar" />
          </h3>
          <div className="members">
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
          </div>
        </div>
        <div className="members__wrapper">
          <h3>
            <div className="title-bar" />
            Programmes
            <div className="title-bar" />
          </h3>
          <div className="members">
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
          </div>
        </div>
        <div className="members__wrapper">
          <h3>
            <div className="title-bar" />
            Communications
            <div className="title-bar" />
          </h3>
          <div className="members">
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
          </div>
        </div>
        <div className="members__wrapper">
          <h3>
            <div className="title-bar" />
            Facility management
            <div className="title-bar" />
          </h3>
          <div className="members">
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/OJ.png"
              name="Ojone Akor"
              title="Chief Operating Officer"
              bioLink=""
            />
          </div>
        </div>
      </div>
    </div>
  );
}
