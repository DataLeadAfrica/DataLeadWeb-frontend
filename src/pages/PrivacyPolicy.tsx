import "../css/privacy-policy.css";

export default function PrivacyPolicy() {
  return (
    <div className="privacy-policy">
      <h1>Data-Lead Africa Privacy Policy</h1>
      <p>
        At Data-Lead Africa, we respect your privacy and are committed to
        protecting your personal information. This Privacy Policy explains how
        we collect, use, and safeguard your data when you interact with our
        website, bootcamps, and services.
      </p>
      <ol>
        <li>
          Information We Collect
          <div>
            <p>We may collect:</p>
            <ul>
              <li>
                Personal information: Name, email address, phone number, and
                other details you provide when registering.
              </li>
              <li>
                Payment details: Processed securely by our payment partner
                (Paystack). We do not store your card or bank details.
              </li>
              <li>
                Technical information: Such as browser type, IP address, and
                cookies to improve your website experience.
              </li>
            </ul>
          </div>
        </li>
        <li>
          How We Use Your Information
          <div>
            <p>We use your data to:</p>
            <ul>
              <li>Process your Bootcamp registration and confirm payments.</li>
              <li>
                Provide updates, learning resources, and event information.
              </li>
              <li>Improve our training programs and communication.</li>
            </ul>
          </div>
        </li>
        <li>
          Sharing of Information
          <p>
            We do not sell, rent, or share your personal data with any third
            party. Your information is used only within Data-Lead Africa and
            processed securely through trusted tools (e.g., Paystack for
            payments, MailerLite for emails).
          </p>
        </li>
        <li>
          Your Rights
          <div>
            <p>You have the right to:</p>
            <ul>
              <li>Access and correct your personal information.</li>
              <li>
                Opt out of marketing emails at any time (unsubscribe link
                included).
              </li>
              <li>
                Request deletion of your information, unless required for legal
                compliance.
              </li>
            </ul>
            <p>For requests, contact us at: info@dataleadafrica.com .</p>
          </div>
        </li>
        <li>
          Data Retention
          <p>
            We retain your data only as long as necessary to provide services or
            meet legal requirements.
          </p>
        </li>
        <li>
          Security
          <p>
            We implement strict security measures to protect your data against
            loss, misuse, or unauthorized access.
          </p>
        </li>
        <li>
          Updates
          <p>
            We may update this Privacy Policy occasionally, and changes will be
            posted on our website with a revised date.
          </p>
        </li>
      </ol>
      <div>
        <p>Contact us</p>
        <p>If you have any questions, please contact us:</p>
        <p>Data-Lead Africa</p>
        <p>
          Email:{" "}
          <a href="mailto:info@dataleadafrica.com">info@dataleadafrica.com</a>
        </p>
        <p>
          Phone: <a href="tel:+2349166661234">+2349166661234</a>
        </p>
        <p>
          Website: <a href="www.dataleadafrica.com">www.dataleadafrica.com</a>
        </p>
      </div>
    </div>
  );
}
