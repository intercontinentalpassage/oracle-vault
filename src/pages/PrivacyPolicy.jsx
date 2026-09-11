import { Link } from "react-router-dom";

const sectionStyle = { marginTop: 22 };
const h2Style = { fontSize: 16, marginBottom: 8 };
const pStyle = { color: "#3A423F", fontSize: 14, lineHeight: 1.6, marginTop: 8 };
const ulStyle = { color: "#3A423F", fontSize: 14, lineHeight: 1.6, marginTop: 8, paddingLeft: 20 };

export default function PrivacyPolicy() {
  return (
    <div className="ov-page" style={{ padding: "clamp(26px, 4vw, 56px) clamp(14px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link to="/" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Back to Oracle Vault
        </Link>

        <h1 style={{ fontSize: 22, marginTop: 20, marginBottom: 4 }}>Privacy Policy</h1>
        <p style={{ color: "#5A6560", fontSize: 13 }}>
          <strong>Oracle Vault</strong><br />
          Last updated: September 11, 2026
        </p>

        <p style={pStyle}>
          This Privacy Policy explains how Intercontinental Passage ("we," "us," or "our")
          collects, uses, and protects information when you use the Oracle Vault website,
          Telegram bot, and related services (the "Service").
        </p>
        <p style={{ ...pStyle, fontStyle: "italic" }}>
          Same note as our Terms of Service: this is a general-purpose draft, not a substitute
          for legal review. Given Thailand's Personal Data Protection Act (PDPA) applies to
          businesses handling personal data of individuals in Thailand, we recommend having
          this reviewed by qualified local counsel before publishing it.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>1. Information We Collect</h2>
          <p style={pStyle}><strong>From customers (no account required):</strong></p>
          <ul style={ulStyle}>
            <li>Phone number — required to submit a ticket purchase request or to look up your purchase history under "My Tickets"</li>
            <li>Name — optional, provided at your discretion when checking out</li>
          </ul>
          <p style={pStyle}>
            We do not require or collect an email address, physical address, or any payment
            card information from customers. <strong>Payment itself happens outside this
            platform</strong> — we do not process, transmit, or store payment details of any kind.
          </p>
          <p style={pStyle}><strong>From staff (Admin and Agent accounts):</strong></p>
          <ul style={ulStyle}>
            <li>Email address (or, if none is provided, a system-generated placeholder used only to create the login)</li>
            <li>Password (stored securely by our authentication provider, Supabase — we do not have access to your plain-text password)</li>
            <li>Display name and role</li>
          </ul>
          <p style={pStyle}><strong>Automatically, from anyone using the Service:</strong></p>
          <ul style={ulStyle}>
            <li>Standard technical data any website receives (e.g., IP address, browser type) as part of normal web traffic, via our hosting provider (Netlify) and backend provider (Supabase). We do not run any analytics or advertising tracking on this Service.</li>
          </ul>
          <p style={pStyle}><strong>If you use our Telegram bot:</strong></p>
          <ul style={ulStyle}>
            <li>Your Telegram chat ID and any phone number you provide through the bot, used the same way as information provided on the website — to process and look up purchase requests.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>2. How We Use Your Information</h2>
          <ul style={ulStyle}>
            <li>Process and fulfill ticket purchase requests</li>
            <li>Let you look up the status of your own purchases via phone number</li>
            <li>Notify relevant staff or Agents of a new request</li>
            <li>Publish winning-number results and let you check them (this does not require any personal information)</li>
            <li>Maintain and improve the Service, and investigate misuse or fraud</li>
          </ul>
          <p style={pStyle}>
            We do not sell your personal information, and we do not share it with third
            parties for their own marketing purposes.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>3. Where Your Information Is Stored</h2>
          <p style={pStyle}>
            Data is stored with <strong>Supabase</strong> (our database, authentication, and
            file storage provider, hosted in the Singapore region) and served via
            <strong> Netlify</strong> (our web hosting provider). If you use our Telegram bot,
            message content also passes through <strong>Telegram's</strong> own servers,
            subject to Telegram's own privacy practices.
          </p>
          <p style={pStyle}>
            Access to customer data is restricted at the database level — staff can only see
            the purchase requests, sales, and customer records relevant to their role (an
            Agent, for example, can only see their own customers, not the whole platform's).
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>4. Data Retention</h2>
          <p style={pStyle}>
            We retain purchase request, sales, and customer records for as long as needed to
            operate the Service and to satisfy any recordkeeping obligations under applicable
            lottery or tax regulations. If you would like your information removed, contact us
            using the details below and we will review your request.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>5. Your Rights</h2>
          <p style={pStyle}>
            Depending on your location, you may have rights to access, correct, or request
            deletion of your personal information. To make such a request, contact us at the
            email below. We may need to verify your identity (for example, by confirming the
            phone number associated with your purchase history) before processing certain
            requests.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>6. Children's Privacy</h2>
          <p style={pStyle}>
            This Service is not directed at, and is not intended for use by, anyone under 20
            years of age, consistent with the minimum age required to purchase lottery tickets
            through this Service. We do not knowingly collect information from individuals
            below this age.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>7. Third-Party Links</h2>
          <p style={pStyle}>
            The Service may link to third-party platforms, including Telegram. This Policy
            does not cover the privacy practices of those third parties — please review their
            own privacy policies separately.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>8. Changes to This Policy</h2>
          <p style={pStyle}>
            We may update this Privacy Policy from time to time. Material changes will be
            reflected by updating the "Last updated" date above. Continued use of the Service
            after changes take effect constitutes acceptance of the revised Policy.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>9. Contact</h2>
          <p style={pStyle}>
            Questions about this Privacy Policy, or requests regarding your personal
            information, can be sent to:<br />
            <strong>saimwunnaw@gmail.com</strong>
          </p>
        </section>

        <p style={{ ...pStyle, fontStyle: "italic", marginTop: 32, borderTop: "1px solid #E7EBE9", paddingTop: 16 }}>
          This document is a general-purpose draft and has not been reviewed by a lawyer. We
          recommend having this reviewed by qualified local counsel, particularly for
          compliance with Thailand's Personal Data Protection Act (PDPA), before publishing it
          or relying on it.
        </p>
      </div>
    </div>
  );
}
