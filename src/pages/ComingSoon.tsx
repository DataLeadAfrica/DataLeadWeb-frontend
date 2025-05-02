import "../css/coming-soon.css";

const capitalize = (str: string) => {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function ComingSoon({ name }: { name: string }) {
  return (
    <div className="coming-soon__page">
      <img src="/assets/star.svg" alt="" />
      <h1>Coming Soon</h1>
      <p>
        Get ready to master the skills needed to become an expert in {name}. Our{" "}
        <span>{capitalize(name)} Bootcamp </span>
        is launching soon, and we're building a waitlist for early access. Sign
        up now and secure your spot!"
      </p>
      <form action="" className="waitlist">
        <div className="waitlist__input">
          <label htmlFor="email">Email</label>
          <input type="email" required />
        </div>
        <button className="btn">Join the waitlist</button>
      </form>
    </div>
  );
}
