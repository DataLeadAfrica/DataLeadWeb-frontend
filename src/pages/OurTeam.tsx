import "../css/our-team.css";

function TeamMember({
  img_src,
  name,
  title,
  instagram,
  linkedin,
  twitter,
}: {
  img_src: string;
  name: string;
  title: string;
  instagram: string;
  linkedin: string;
  twitter: string;
}) {
  return (
    <div className="our-team__member">
      <div className="member__image">
        <img src={img_src} alt="" />
      </div>
      <h3>{name}</h3>
      <p>{title}</p>
      <div className="socials">
        <a href={instagram} className="socials__link">
          <i className="nf nf-fa-instagram"></i>
        </a>
        <a href={linkedin} className="socials__link">
          <i className="nf nf-dev-linkedin"></i>
        </a>
        <a href={twitter} className="socials__link">
          <i className="nf nf-dev-twitter"></i>
        </a>
      </div>
    </div>
  );
}

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
        <TeamMember
          img_src="assets/blog/temp.svg"
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
        <TeamMember
          img_src="assets/blog/temp.svg"
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
        <TeamMember
          img_src=""
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
        <TeamMember
          img_src=""
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
        <TeamMember
          img_src=""
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
        <TeamMember
          img_src=""
          name="John Doe"
          title="Head of"
          instagram=""
          linkedin=""
          twitter=""
        />
      </div>
    </div>
  );
}
