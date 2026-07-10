import React from "react";

export const metadata = {
  title: "StudySnap — Privacy Policy",
  description: "Privacy Policy and data practices for the StudySnap educational utility application.",
};

export default function PrivacyPage() {
  return (
    <div style={styles.container}>
      <main style={styles.card}>
        <h1 style={styles.title}>⚡ Study<span style={styles.accent}>Snap</span></h1>
        <h2 style={styles.subtitle}>Privacy Policy</h2>
        <p style={styles.date}>Effective Date: July 10, 2026</p>

        <hr style={styles.divider} />

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>1. Introduction</h3>
          <p style={styles.text}>
            StudySnap ("we," "us," or "our") values your privacy. This Privacy Policy explains how we collect, use, disclose, and protect your information when you use our mobile application and related API services.
          </p>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>2. Information We Collect</h3>
          <p style={styles.text}>
            To deliver our core study material generation features, we collect the following categories of information:
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              <strong>Account Credentials (Sign-In)</strong>: When you authenticate using Google or Apple sign-in, we store your email address and a unique provider user identifier. This is used to synchronize study sessions across your devices and enforce account-level cost limits.
            </li>
            <li style={styles.listItem}>
              <strong>Lecture Audio & Photos</strong>: Audio recordings and images of slides/whiteboards that you capture are transmitted securely to our servers to perform transcription, text extraction (OCR), and study guide summarization. We do not store these media assets persistently; they are processed ephemerally and deleted from memory.
            </li>
            <li style={styles.listItem}>
              <strong>Device Diagnostics & Usage Telemetry</strong>: We collect anonymous client-side identifiers (install IDs), error logs, and basic interaction events (e.g. "onboarding completed", "generation failed") to detect abuse, prevent spamming, and resolve application bugs.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>3. How We Share Your Information</h3>
          <p style={styles.text}>
            We do not sell your personal data. We share information only with trusted third-party service providers who assist us in operating our platform:
          </p>
          <ul style={styles.list}>
            <li style={styles.listItem}>
              <strong>Artificial Intelligence APIs (OpenAI & DeepSeek)</strong>: Audio transcripts and slide images are forwarded to OpenAI and DeepSeek to perform OCR, speech-to-text, and document summarization.
            </li>
            <li style={styles.listItem}>
              <strong>Database & Auth Hosts (Supabase & Neon)</strong>: Supabase manages authentication directories, and Neon hosts our PostgreSQL database containing user profiles and usage telemetry.
            </li>
          </ul>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>4. Data Security</h3>
          <p style={styles.text}>
            All transmissions between the mobile app, our backend servers, and third-party APIs are encrypted in transit using Transport Layer Security (HTTPS/SSL). We implement industry-standard practices to guard your email and session data.
          </p>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>5. Your Rights: Account & Data Deletion</h3>
          <p style={styles.text}>
            You have full control over your data. You can delete your account at any time directly inside the mobile app (Settings ➔ Delete & Anonymize Account). Triggering this action will immediately anonymize your email address in our database and delete your user profile from our Supabase authentication directory.
          </p>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>6. Contact Us</h3>
          <p style={styles.text}>
            If you have any questions about this Privacy Policy or our data practices, please contact us via email at: <strong>asmrforall1999@gmail.com</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#0a0a0f",
    color: "#f3f4f6",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#11121c",
    border: "1px solid #1e2030",
    borderRadius: "16px",
    maxWidth: "800px",
    width: "100%",
    padding: "40px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
  },
  title: {
    fontSize: "28px",
    fontWeight: "bold",
    margin: 0,
    color: "#ffffff",
    textAlign: "center" as const,
  },
  accent: {
    color: "#7c3aed",
  },
  subtitle: {
    fontSize: "20px",
    margin: "10px 0 0 0",
    color: "#9ca3af",
    textAlign: "center" as const,
  },
  date: {
    fontSize: "12px",
    color: "#6b7280",
    textAlign: "center" as const,
    marginTop: "8px",
  },
  divider: {
    border: "0",
    height: "1px",
    backgroundColor: "#1e2030",
    margin: "24px 0",
  },
  section: {
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: "10px",
  },
  text: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: "#d1d5db",
    margin: "0 0 10px 0",
  },
  list: {
    margin: "0 0 10px 0",
    paddingLeft: "20px",
  },
  listItem: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: "#d1d5db",
    marginBottom: "8px",
  },
};
