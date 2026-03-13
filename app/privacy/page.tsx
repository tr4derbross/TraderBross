import LegalPage from "@/components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="13.03.26">
      <p>
        TraderBross (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a crypto news trading terminal and related
        tools for traders.
      </p>

      <section>
        <h2>1. Information We Collect</h2>
        <p>We may collect the following information:</p>
        <ul>
          <li>Account information such as email address and login details</li>
          <li>Basic usage data such as pages visited, device/browser information, and interaction data</li>
          <li>Exchange connection metadata required to provide platform functionality</li>
          <li>Support messages or contact form submissions</li>
        </ul>
        <p>We do not claim ownership of user funds or exchange accounts.</p>
      </section>

      <section>
        <h2>2. How We Use Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Provide access to TraderBross</li>
          <li>Maintain account security</li>
          <li>Improve product performance and user experience</li>
          <li>Monitor errors, abuse, and suspicious activity</li>
          <li>Communicate important product or account-related updates</li>
        </ul>
      </section>

      <section>
        <h2>3. Exchange Credentials and Security</h2>
        <p>
          If exchange connectivity is supported, TraderBross is designed to use credentials only for
          the purpose of enabling user-authorized platform functionality.
        </p>
        <p>Users are responsible for creating exchange API keys with the correct permissions.</p>
        <p>We strongly recommend:</p>
        <ul>
          <li>disabling withdrawal permissions</li>
          <li>using restricted API permissions only</li>
          <li>using exchange-side IP restrictions whenever supported</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <p>
          We retain data only as long as reasonably necessary to provide the service, maintain
          security, comply with legal obligations, and resolve disputes.
        </p>
      </section>

      <section>
        <h2>5. Cookies and Analytics</h2>
        <p>
          We may use cookies or similar technologies for authentication, session handling, analytics,
          and platform improvement.
        </p>
      </section>

      <section>
        <h2>6. Third-Party Services</h2>
        <p>
          TraderBross may rely on third-party infrastructure and service providers, such as hosting,
          analytics, authentication, database, and market data providers.
        </p>
      </section>

      <section>
        <h2>7. Your Responsibilities</h2>
        <p>You are responsible for:</p>
        <ul>
          <li>protecting your account credentials</li>
          <li>using proper exchange API permissions</li>
          <li>reviewing the risks of trading and platform connectivity</li>
        </ul>
      </section>

      <section>
        <h2>8. No Custody</h2>
        <p>TraderBross is not a bank, broker, custodian, or exchange. We do not hold customer funds.</p>
      </section>

      <section>
        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Continued use of the platform after
          updates means you accept the revised policy.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>For privacy-related questions, contact us at:</p>
        <p>
          <strong>Nikokaya24@gmail.com</strong>
        </p>
      </section>
    </LegalPage>
  );
}
