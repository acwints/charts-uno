import './LegalPage.css';

export function TermsPage() {
  return (
    <article className="legal">
      <h1>Terms of Service</h1>
      <span className="legal-updated">Last updated: March 12, 2026</span>

      <p>
        These Terms of Service ("Terms") govern your access to and use of
        Chartsuno ("Service"), operated by WA LLC ("we", "us", "our"). By
        creating an account or using the Service you agree to these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 13 years old to use Chartsuno. If you are under 18,
        you represent that a parent or legal guardian has reviewed and agreed to
        these Terms on your behalf.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account
        credentials and for all activity that occurs under your account. Notify
        us immediately at{' '}
        <a href="mailto:support@chartsuno.com">support@chartsuno.com</a> if you
        suspect unauthorized access.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
        <li>Upload or transmit viruses, malware, or other harmful code.</li>
        <li>Attempt to gain unauthorized access to any part of the Service.</li>
        <li>Scrape, crawl, or use automated means to access the Service without our written consent.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
      </ul>

      <h2>4. Your Content</h2>
      <p>
        You retain ownership of the charts, data, and other content you create
        ("User Content"). By making User Content public, you grant us a
        non-exclusive, worldwide, royalty-free license to display it within the
        Service. You can revoke this license at any time by making the content
        private or deleting it.
      </p>

      <h2>5. Subscriptions &amp; Billing</h2>
      <p>
        Paid plans are billed in advance on a monthly or annual cycle. You may
        cancel at any time; your plan remains active through the end of the
        current billing period. Refunds are issued at our discretion. We reserve
        the right to change pricing with 30 days' notice.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        The Service, including its design, code, and branding, is owned by WA
        LLC and protected by applicable intellectual property laws. These Terms
        do not grant you any right to use our trademarks or branding without
        prior written consent.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without warranties of
        any kind, express or implied, including but not limited to
        merchantability, fitness for a particular purpose, and non-infringement.
        We do not guarantee the accuracy of AI-generated chart data or
        suggestions.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, WA LLC shall not be liable for
        any indirect, incidental, special, consequential, or punitive damages,
        or any loss of profits, data, or goodwill, arising out of or related to
        your use of the Service.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access at any time for violation of
        these Terms or for any reason with reasonable notice. Upon termination,
        your right to use the Service ceases immediately, though you may request
        an export of your data within 30 days.
      </p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify you of
        material changes by posting the updated Terms on this page and updating
        the "Last updated" date. Your continued use of the Service constitutes
        acceptance of the revised Terms.
      </p>

      <h2>11. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the State of Washington, without
        regard to conflict of law principles. Any disputes shall be resolved in
        the courts located in King County, Washington.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href="mailto:support@chartsuno.com">support@chartsuno.com</a>.
      </p>
    </article>
  );
}
