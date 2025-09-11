import "../css/payment-success.css";

export default function PaymentSuccess() {
  return (
    <div className="payment-success">
      <div className="payment-success__card">
        <p>Payment Succesful</p>
        <div className="payment-success__text">
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
            <a href="mailto:info@dataleadafrica.com">info@dataleadafrica.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
