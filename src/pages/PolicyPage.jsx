import React from "react";
import SiteFooter from "../components/layout/SiteFooter.jsx";
import SiteHeader from "../components/layout/SiteHeader.jsx";

function PrivacyContent() {
  return (
    <div className="policy-content">
      <p className="policy-lead">This policy explains what information is handled when you visit the Paperwork website and how PDF files are processed in this browser preview.</p>
      <section><h2>1. Information on this preview</h2><p>PDF tools run locally in your browser. PDF files you select are processed on your device and are not uploaded to Paperwork servers. Please avoid using this preview for documents if your device is shared or compromised.</p></section>
      <section><h2>2. Information you choose to send</h2><p>This preview does not include a contact form. If you contact us through another channel, we receive the information you include in your message, such as your email address and the contents of your request. We use it to respond and handle the request. Avoid including confidential or sensitive information unless it is necessary.</p></section>
      <section><h2>3. Cookies and site analytics</h2><p>This preview is not designed to require cookies for its basic pages. If analytics, cookies, or similar technologies are introduced, this policy will be updated to describe what they collect and how you can manage them.</p></section>
      <section><h2>4. Service providers and retention</h2><p>PDF processing happens in your browser. The static website is hosted by an infrastructure provider, which may process basic technical request data to deliver and protect the site.</p></section>
      <section><h2>5. Your choices and questions</h2><p>You can choose not to provide information. If you have sent us a message and want to ask about it, use the contact method through which you reached us. You can also clear your browser tab or close the page to release files loaded for local processing.</p></section>
      <section><h2>6. Changes to this policy</h2><p>We may revise this policy as Paperwork changes. The date above shows when it was most recently updated. Please review it again as new features become available.</p></section>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="policy-content">
      <p className="policy-lead">These terms cover your use of the Paperwork preview website. By using the site, you agree to these terms.</p>
      <section><h2>1. Preview service</h2><p>Paperwork provides browser-based PDF tools. Files selected in a tool are processed locally in your browser, not uploaded to Paperwork servers. Some tools may have format or password limitations shown on the tool page.</p></section>
      <section><h2>2. Acceptable use</h2><p>Use the site lawfully and do not interfere with its operation, attempt to gain unauthorized access, or use it to distribute harmful code. Paperwork does not store your selected documents. Keep your own copy of any original file and review every processed result before use.</p></section>
      <section><h2>3. Intellectual property</h2><p>The site, its name, design, and original content are provided by the Paperwork team and are protected by applicable intellectual property laws. These terms do not transfer ownership to you.</p></section>
      <section><h2>4. No professional advice</h2><p>Information on this site is general product information, not legal, financial, or other professional advice. You are responsible for checking documents and their contents before relying on them.</p></section>
      <section><h2>5. Availability and changes</h2><p>The preview may change, be interrupted, or be withdrawn at any time. We make no promise that planned features will be launched in a particular form or by a particular date.</p></section>
      <section><h2>6. Liability</h2><p>To the extent permitted by law, the preview is provided as is and without warranties of uninterrupted availability or fitness for a particular purpose. Nothing in these terms limits rights that cannot lawfully be limited.</p></section>
      <section><h2>7. Updates and contact</h2><p>We may update these terms as the service develops. The date above identifies the latest revision. If you have a question about these terms, contact us through the channel you used to access Paperwork.</p></section>
    </div>
  );
}

export default function PolicyPage({ type }) {
  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy policy" : "Terms of use";

  return (
    <>
      <SiteHeader activePage={type} />
      <main className="policy-page section-wrap">
        <div className="policy-heading">
          <div className="eyebrow"><span className="eyebrow-line" /> PAPERWORK / {isPrivacy ? "PRIVACY" : "TERMS"}</div>
          <h1>{title}<em>.</em></h1>
          <p className="policy-updated">Last updated: October 1, 2026</p>
        </div>
        <div className="preview-banner">
          <span className="notice-dot" />
          <p>PDF tools process files locally in your browser. The preview does not upload selected documents to Paperwork servers.</p>
        </div>
        {isPrivacy ? <PrivacyContent /> : <TermsContent />}
      </main>
      <SiteFooter />
    </>
  );
}
