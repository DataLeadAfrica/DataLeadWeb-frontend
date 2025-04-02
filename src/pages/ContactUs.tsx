import Card from "../components/Card";
import "../css/contact-us.css";

export default function ContactUs() {
  return (
    <div className="contact-us__page">
      <div className="contact-us__head">
        <h1>Contact Us</h1>
        <p>
          Have a question? Need more information? We're here to help. Contact us
          today and we'll get back to you via email shortly.
        </p>
      </div>
      <form className="contact-us__form">
        <div className="form__inner">
          <div>
            <div>
              <label htmlFor="name">Name</label>
              <Card>
                <input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Enter your name"
                />
              </Card>
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <Card>
                <input
                  type="text"
                  name="email"
                  id="email"
                  placeholder="Enter your email"
                />
              </Card>
            </div>
          </div>
          <div>
            <div>
              <label htmlFor="message">Message</label>
              <Card>
                <textarea
                  name="message"
                  id="message"
                  placeholder="Enter your message"
                ></textarea>
              </Card>
            </div>
          </div>
        </div>
        <button className="btn">send</button>
      </form>
      <div className="contact-us__enquiries"></div>
    </div>
  );
}
