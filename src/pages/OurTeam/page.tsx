import { Link } from "react-router";

import "./page.css";
import { StaffInfo } from "./router";

function TeamMember({
  imgSrc,
  name,
  title,
  bioRoute,
}: {
  imgSrc: string;
  name: string;
  title: string;
  bioRoute: string;
}) {
  return (
    <Link to={bioRoute} className="our-team__member">
      <div className="member__image">
        <img src={imgSrc} alt="" />
      </div>
      <div className="member__info">
        <p className="member__name">{name}</p>
        <p>{title}</p>
      </div>
    </Link>
  );
}

export default function OurTeam({ staffInfo }: { staffInfo: StaffInfo }) {
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
        {Object.entries(staffInfo).map(([_, v]) => {
          return (
            <TeamMember
              imgSrc={v.imgSrc}
              name={v.name}
              title={v.title}
              bioRoute={v.bioRoute}
            />
          );
        })}
      </div>
    </div>
  );
}
