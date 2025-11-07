import { Route } from "react-router";
import { routes } from "../routes";
import Success from "./page";

export default function successRouter() {
  return (
    <>
      <Route
        path={routes.coursesDataAnalyticsRegistrationSuccess}
        element={
          <Success>
            <p>Thank you for registering for the Data Analytics Bootcamp. </p>
            <p>
              Your application has been received. To secure your seat, please
              complete payment and confirm your details using the steps below.
            </p>
            <p>What happens next:</p>
            <ol>
              <li>
                Check your email:
                <p>
                  You’ll receive a confirmation email shortly with your
                  registration ID and a link to the fees & payment options. If
                  you don’t see it within 10 minutes, check your Spam/Junk
                  folder.
                </p>
              </li>
              <li>
                Complete your payment (required to secure your seat)
                <p>
                  Payment must be confirmed before onboarding. Use the link in
                  your email (or the button below) to view payment options and
                  instructions.
                </p>
              </li>
              <li>
                Upload proof of payment
                <p>
                  After payment, upload your receipt/screenshot via the payment
                  confirmation email. You’ll receive an acknowledgement once
                  verified.
                </p>
              </li>
              <li>
                Onboarding & orientation
                <p>
                  After payment confirmation, we’ll share your onboarding pack
                  (program calendar, tool setup guides, and pre-work).
                  Orientation details will be sent to your email.
                </p>
              </li>
            </ol>
            <div>
              <p>Need help?</p>
              <p>
                WhatsApp: <a href="tel:+2349166661234"> +234 916 666 1234</a>
              </p>
              <p>
                Email:{" "}
                <a href="mailto:info@dataleadafrica.com">
                  info@dataleadafrica.com
                </a>
              </p>
            </div>
          </Success>
        }
      />
      <Route
        path={routes.coursesDataAnalyticsPaymentSuccess}
        element={
          <Success>
            <p>
              Thank you for your payment. Your transaction was successful, and a
              receipt has been sent to your email by Paystack. You will also
              receive a confirmation email from Data-Lead Africa with details
              about your Bootcamp enrolment and the next steps.
            </p>
            <p>
              If you experience any difficulty registering or have accessibility
              concerns, kindly contact us via WhatsApp at{" "}
              <a href="tel:+2349166661234">+234 916 666 1234</a> or email{" "}
              <a href="mailto:info@dataleadafrica.com">
                info@dataleadafrica.com
              </a>
            </p>
          </Success>
        }
      />
    </>
  );
}
