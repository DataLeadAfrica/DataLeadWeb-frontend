import { FormEventHandler } from "react";
import Card from "../components/Card";
import "../css/contact-us.css";

const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  const name = formData.get("name");
  const email = formData.get("email");
  const message = formData.get("message");
  fetch("https://formsubmit.co/ajax/kuluislit@gmail.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: name,
      email: email,
      message: message,
    }),
  }).then((response) => {
    if (!response.ok) {
      console.log("Error while sending response");
    } else {
    }
  });
};

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
      <form className="contact-us__form" onSubmit={handleSubmit}>
        <div className="form__inner">
          <div>
            <div className="input__wrapper">
              <label htmlFor="name">Name</label>
              <Card>
                <input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Enter your name"
                  required
                />
              </Card>
            </div>
            <div className="input__wrapper">
              <label htmlFor="email">Email</label>
              <Card>
                <input
                  type="email"
                  name="email"
                  id="email"
                  placeholder="Enter your email"
                  required
                />
              </Card>
            </div>
          </div>
          <div className="input__wrapper">
            <label htmlFor="message">Message</label>
            <Card>
              <textarea
                name="message"
                id="message"
                placeholder="Enter your message"
                required
              ></textarea>
            </Card>
          </div>
        </div>
        <button className="btn">Send</button>
      </form>
      <div className="contact-us__enquiries"></div>
    </div>
  );
}
