import { FormEventHandler, useState } from "react";
import "./page.css";

export default function ContactUs() {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const name = formData.get("name");
    const email = formData.get("email");
    const message = formData.get("message");
    fetch("https://formsubmit.co/ajax/da1f4391d4119597412aae0932a6b544", {
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
      if (response.ok) {
        setIsSuccessVisible(true);
        console.log("Email sent succsfully");
      } else {
        setIsFailureVisible(true);
        console.log("Error while sending response");
      }
    });
  };

  const PopUpSucces = () => {
    return (
      <div className="popup">
        <div className="blur" onClick={() => setIsSuccessVisible(false)}></div>
        <div className="inner">
          <p className="inner__head inner__head--success">Thank You</p>
          <p className="inner__message">
            Your message has been received. We appreciate you reaching out and
            will respond to your inquiry shortly.
          </p>
          <button className="btn" onClick={() => setIsSuccessVisible(false)}>
            Close
          </button>
        </div>
      </div>
    );
  };

  const PopUpFailure = () => {
    return (
      <div className="popup">
        <div className="blur" onClick={() => setIsFailureVisible(false)}></div>
        <div className="inner">
          <p className="inner__head inner__head--failure">
            Sorry, something went wrong.
          </p>
          <p className="inner__message">
            Your message could not be sent at this time. Please refresh the page
            and try again
          </p>
          <button className="btn" onClick={() => setIsFailureVisible(false)}>
            Close
          </button>
        </div>
      </div>
    );
  };

  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [isFailureVisible, setIsFailureVisible] = useState(false);

  return (
    <div className="contact-us__page">
      {isSuccessVisible && <PopUpSucces />}
      {isFailureVisible && <PopUpFailure />}
      <div className="contact-us__head">
        <h1>Contact Us</h1>
        <p>
          Have a question? Need more information? We're here to help. Contact us
          today and we'll get back to you via email shortly.
        </p>
      </div>
      <div className="contact-us__options">
        <div className="contact-us__enquiries">
          <div className="enquiries__head">
            <h2>Other Enquiries</h2>
            <p>
              If you need to contact us for any other matters, please use the
              following contact channels:
            </p>
          </div>
          <div className="contacts">
            <div className="contact">
              <i className="nf nf-fa-phone"></i>
              <div className="numbers">
                <a href="tel:+2349166661234">+234-916-6661-234</a>
                <a href="tel:+2347030500741">+234-703-0500-741</a>
              </div>
            </div>
            <div className="contact">
              <i className="nf nf-oct-mail"></i>
              <a href="mailto:info@dataleadafrica.com">
                info@dataleadafrica.com
              </a>
            </div>
            <div className="contact">
              <i className="nf nf-oct-location"></i>
              <address>
                Plot 759, Bassan Plaza, Central Business District, Abuja.
              </address>
            </div>
          </div>
          <div className="social-contacts">
            <a href="https://www.facebook.com/DataLead.Africa/" className="">
              <i className="nf nf-dev-facebook"></i>
            </a>
            <a href="https://x.com/datalead_africa?lang=en" className="">
              <i className="nf nf-dev-twitter"></i>
            </a>
            <a
              href="https://www.instagram.com/datalead_africa/?hl=en"
              className=""
            >
              <i className="nf nf-fa-instagram"></i>
            </a>
            <a
              href="https://ng.linkedin.com/company/data-leadafrica"
              className=""
            >
              <i className="nf nf-dev-linkedin"></i>
            </a>
          </div>
        </div>
        <form className="contact-us__form" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <label htmlFor="name">Name</label>
            <input
              type="text"
              name="name"
              id="name"
              required
              placeholder="Enter your name"
            />
          </div>
          <div className="input-wrapper">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              name="email"
              id="email"
              required
              placeholder="Enter your email"
            />
          </div>
          <div className="input-wrapper">
            <label htmlFor="subject">Subject</label>
            <input
              type="text"
              name="subject"
              id="subject"
              required
              placeholder="Enter the subject"
            />
          </div>
          <div className="input-wrapper">
            <label htmlFor="message">Message</label>
            <textarea
              name="message"
              id="message"
              required
              placeholder="Enter the message"
            />
          </div>

          <button className="btn">Send</button>
        </form>
      </div>
    </div>
  );
}
