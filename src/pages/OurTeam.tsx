import { Link } from "react-router";
import "../css/our-team.css";
import Card from "../components/Card";
import { routes } from "../routes";

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
          {bioLink != "" && (
            <Link to={bioLink} className="btn btn--transparent">
              Read Bio
            </Link>
          )}
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
              imgLink="/assets/our-team/Doc.png"
              name="Dr. Arowolo Ayoola"
              title="Lead Partner"
              bioLink={routes.ourTeamDrAyo}
            />
            <TeamMember
              imgLink="/assets/our-team/Abdulsalam.png"
              name="Abdulsalam Oluwatosin"
              title="Senior Partner and Co-Founder, Data-Lead Africa"
              bioLink={routes.ourTeamAbdul}
            />
            <TeamMember
              imgLink="/assets/our-team/Felicia.png"
              name="Felicia Ayodele"
              title="Head of Communications"
              bioLink={routes.ourTeamFelicia}
            />
            <TeamMember
              imgLink="/assets/our-team/Sefunmi.png"
              name="Sefunmi Oluwole"
              title="DEI Partnerships, Advocacy, Policy Strengthening, & Program Dev. Manager"
              bioLink={routes.ourTeamSefunmi}
            />
          </div>
        </div>
        <div className="members__wrapper">
          <h3>
            <div className="title-bar" />
            Programs
            <div className="title-bar" />
          </h3>
          <div className="members">
            <TeamMember
              imgLink="/assets/our-team/Loveth.png"
              name="Oche Loveth"
              title="Head of Programs"
              bioLink={routes.ourTeamLoveth}
            />
            <TeamMember
              imgLink="/assets/our-team/Eniola.png"
              name="Oyekale Eniola Yetunde"
              title="Knowledge Management officer"
              bioLink={routes.ourTeamEniola}
            />
            <TeamMember
              imgLink="/assets/our-team/Isaac.png"
              name="Isaac Joshua"
              title="Program Assistant/Grant Writer"
              bioLink=""
            />
            <TeamMember
              imgLink="/assets/our-team/Adaora.png"
              name="Okona Adaora Stephanie"
              title="Programs Branding Offricer"
              bioLink={routes.ourTeamAdaora}
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
              imgLink="/assets/our-team/Maranatha.png"
              name="Maranatha Emmaogboji"
              title="Communications Officer"
              bioLink={routes.ourTeamMaranatha}
            />
            <TeamMember
              imgLink="/assets/our-team/Matthew.png"
              name="Gabriel Matthew"
              title="Communications Officer"
              bioLink={routes.ourTeamMatthew}
            />
            <TeamMember
              imgLink="/assets/our-team/Stephen.png"
              name="Mogaji Adekale Stephen"
              title="Communications Intern"
              bioLink={routes.ourTeamStephen}
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
              imgLink="/assets/our-team/Blessing.png"
              name="Blessing Adem"
              title="Client Response Officer"
              bioLink={routes.ourTeamBlessing}
            />
            <TeamMember
              imgLink="/assets/our-team/Musa.png"
              name="Musa Maimusa"
              title="Security Officer"
              bioLink={routes.ourTeamMusa}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
