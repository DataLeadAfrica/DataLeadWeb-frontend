import { Link } from "react-router";

import { routes } from "../routes";

import "./page.css";

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
    <Link to={bioLink} className="our-team__member">
      <div className="member-image">
        <img src={imgLink} alt="" />
      </div>
      <div className="member-info">
        <p className="member-name">{name}</p>
        <p>{title}</p>
      </div>
    </Link>
  );
}

// NOTE: Ask about image sizes
export default function OurTeam() {
  return (
    <div className="our-team__page">
      <div className="our-team__heading">
        <h1>Meet the Data-Lead Africa Team</h1>
        <p>
          The Data-Lead Africa team is a diverse group of passionate and
          talented individuals dedicated to driving positive change across
          Africa.
        </p>
      </div>
      <div className="our-team__members">
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
          imgLink="/assets/our-team/Sefunmi.png"
          name="Sefunmi Oluwole"
          title="DEI Partnerships, Advocacy, Policy Strengthening, & Program Dev. Manager"
          bioLink={routes.ourTeamSefunmi}
        />
        <TeamMember
          imgLink="/assets/our-team/Felicia.png"
          name="Felicia Ayodele"
          title="Head of Communications"
          bioLink={routes.ourTeamFelicia}
        />
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
          bioLink={routes.ourTeamIsaac}
        />
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
  );
}
