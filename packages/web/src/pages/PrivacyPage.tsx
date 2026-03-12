import './LegalPage.css';

export function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Privacy Policy</h1>
      <span className="legal-updated">Last updated: March 12, 2026</span>

      <p>
        This Privacy Policy explains how WA LLC ("we", "us", "our") collects,
        uses, and protects your information when you use Chartsuno ("Service").
      </p>

      <h2>1. Information We Collect</h2>

      <p><strong>Account information.</strong> When you sign in with Google we
        receive your name, email address, and profile picture. We do not receive
        or store your Google password.</p>

      <p><strong>User content.</strong> Charts, data, and configurations you
        create within the Service.</p>

      <p><strong>Usage data.</strong> We automatically collect device type,
        browser, pages visited, and interaction events to improve the Service.
        This data is not linked to your identity for analytics purposes.</p>

      <p><strong>Cookies.</strong> We use strictly necessary cookies to maintain
        your session. We do not use advertising or third-party tracking cookies.</p>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Service.</li>
        <li>To authenticate your identity and secure your account.</li>
        <li>To process billing and manage subscriptions.</li>
        <li>To send transactional emails (e.g., team invitations, billing receipts).</li>
        <li>To respond to support requests.</li>
      </ul>
      <p>
        We do not sell your personal information. We do not use your data to
        train AI models.
      </p>

      <h2>3. AI-Powered Features</h2>
      <p>
        Chartsuno uses third-party AI services (e.g., Anthropic, OpenAI) to
        analyze images and generate charts. When you use these features, the
        data you submit (such as uploaded images or text prompts) is sent to the
        AI provider for processing. We do not share your account information
        with AI providers. Please review their privacy policies for details on
        how they handle data.
      </p>

      <h2>4. Data Sharing</h2>
      <p>We share your information only in the following circumstances:</p>
      <ul>
        <li><strong>With your team.</strong> Charts published to a team are visible to team members.</li>
        <li><strong>Public charts.</strong> Charts you choose to make public are visible to anyone with the link.</li>
        <li><strong>Service providers.</strong> We use trusted third parties for hosting (Railway, Vercel), payments (Stripe), and email. These providers access data only as needed to perform their services.</li>
        <li><strong>Legal requirements.</strong> We may disclose information if required by law or to protect our rights and safety.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain your account and content data for as long as your account is
        active. If you delete your account, we will remove your personal
        information within 30 days, except where retention is required by law or
        for legitimate business purposes (e.g., billing records).
      </p>

      <h2>6. Data Security</h2>
      <p>
        We implement industry-standard measures to protect your data, including
        encryption in transit (TLS) and at rest. However, no method of
        transmission or storage is 100% secure, and we cannot guarantee absolute
        security.
      </p>

      <h2>7. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request correction or deletion of your data.</li>
        <li>Export your data in a portable format.</li>
        <li>Withdraw consent for optional processing.</li>
      </ul>
      <p>
        To exercise these rights, email{' '}
        <a href="mailto:support@chartsuno.com">support@chartsuno.com</a>.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Service is not directed at children under 13. We do not knowingly
        collect personal information from children under 13. If we learn that we
        have collected such data, we will delete it promptly.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        Your data may be processed in the United States. By using the Service,
        you consent to the transfer of your data to the U.S. and acknowledge
        that data protection laws may differ from your jurisdiction.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of material changes by posting the updated policy and revising the "Last
        updated" date. Continued use of the Service after changes constitutes
        acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions or concerns? Email us at{' '}
        <a href="mailto:support@chartsuno.com">support@chartsuno.com</a>.
      </p>
    </article>
  );
}
