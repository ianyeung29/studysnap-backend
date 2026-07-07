// app/page.tsx — Product Marketing Landing Page
import Image from "next/image";
import styles from "./page.module.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Home() {
  const features = [
    {
      icon: "🎙️",
      title: "Lecture Voice Capture",
      desc: "Record your professor's explanations directly in class. Our integrated audio engine processes speech in real time with high fidelity.",
    },
    {
      icon: "📷",
      title: "Whiteboard Snapping",
      desc: "Never struggle to write down complex formulas or slides. Snap photos of the board, and our AI extracts the exact text and mathematical formulas.",
    },
    {
      icon: "🧠",
      title: "Multimodal AI Synthesis",
      desc: "The magic happens here: we cross-reference spoken lectures with your board photos. If a professor says 'this formula is on the test', we map it instantly.",
    },
    {
      icon: "🏷️",
      title: "AI Auto-Subject Tagging",
      desc: "Zero typing required. Leave the subject label empty, and our AI will automatically identify the academic subject of the lecture and organize your study binder.",
    },
    {
      icon: "🔊",
      title: "Listen on the Go (TTS)",
      desc: "Convert any generated study guide into an audio podcast. Listen to your lecture summaries while walking, commuting, or working out.",
    },
    {
      icon: "🃏",
      title: "Direct Anki/Quizlet Export",
      desc: "One-click export of flashcards into standard tab-separated decks, ready to import directly into Anki or Quizlet for active recall study.",
    },
    {
      icon: "🔒",
      title: "100% Local & Private",
      desc: "All your study guides, flashcards, and recordings are stored directly on your phone. No logins, no database syncs, and no tracking.",
    },
  ];

  const templates = [
    {
      icon: "📝",
      label: "Study Guide",
      desc: "Perfect structured summary of key concepts, formulas, and topics covered in the lecture.",
    },
    {
      icon: "🃏",
      label: "Flashcards",
      desc: "Double-sided Q&A sets formatted to import directly into Anki or study on your device.",
    },
    {
      icon: "📝",
      label: "Exam Prep",
      desc: "Practice multiple-choice and short answer questions based exactly on the class material.",
    },
    {
      icon: "💡",
      label: "Analogy Guide",
      desc: "Complex topics explained using simple real-world analogies to make the concepts stick.",
    },
  ];

  const faqs = [
    {
      q: "How does StudySnap combine audio and photos?",
      a: "When you tap Stop & Generate, our server transcribes the lecture audio using Whisper and extracts text from your whiteboard photos using GPT-4o. The AI then synthesizes both sources, using the photos to correct spelling mistakes in the audio, and the audio to explain the context of the visual slides.",
    },
    {
      q: "Does it require an internet connection?",
      a: "Yes. While recording audio and snapping photos happens locally on your device, the AI transcription and study guide generation requires an active internet connection to communicate with our secure cloud servers.",
    },
    {
      q: "Where are my study guides saved?",
      a: "All generated study guides, flashcards, and exam preps are saved in your phone's secure local storage (AsyncStorage). We do not save your files in the cloud or store them in a database, ensuring complete privacy.",
    },
    {
      q: "How do I install the app?",
      a: "You can download StudySnap directly to your phone. We are currently in public beta. You can download and install the app package for iOS and Android below.",
    },
  ];

  return (
    <div className={styles.main}>
      <Navbar />

      {/* Hero Section */}
      <section className="container">
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <span className="badge badge-purple">✨ StudySnap Beta 1.0</span>
            <h1 className={styles.heroTitle}>
              Capture the Lecture.
              <br />
              Conquer the Exam.
            </h1>
            <p className={styles.heroSubtitle}>
              Stop scrambling to copy down slides. Record your professor's voice
              and snap photos of the whiteboard. StudySnap's AI instantly merges
              them into custom study guides, flashcards, and practice tests.
            </p>
            <div className={styles.downloadBadges} id="download">
              <a href="#" className={styles.downloadBtn}>
                <span className={styles.btnIcon}>🤖</span>
                <span className={styles.btnText}>
                  <span className={styles.btnSub}>Download for</span>
                  <span className={styles.btnLabel}>Android (APK)</span>
                </span>
              </a>
              <a href="#" className={styles.downloadBtn}>
                <span className={styles.btnIcon}>🍏</span>
                <span className={styles.btnText}>
                  <span className={styles.btnSub}>Download for</span>
                  <span className={styles.btnLabel}>iOS (TestFlight)</span>
                </span>
              </a>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <Image
              src="/app_preview.png"
              alt="StudySnap Mobile App Interface Mockup"
              width={360}
              height={720}
              className={styles.phoneMockup}
              priority
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container" id="features">
        <div className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <span className="badge badge-purple">🎯 Built for students</span>
            <h2>Why StudySnap is Different</h2>
            <p>
              Traditional note apps make you type. StudySnap combines sound and
              sight to build the perfect study companion.
            </p>
          </div>
          <div className={styles.featuresGrid}>
            {features.map((feat, i) => (
              <div key={i} className={styles.featureCard}>
                <span className={styles.cardIcon}>{feat.icon}</span>
                <h3 className={styles.cardTitle}>{feat.title}</h3>
                <p className={styles.cardDesc}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section className={styles.templatesSection}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className="badge badge-purple">📚 Study Formats</span>
            <h2>Convert Your Lecture Into Anything</h2>
            <p>Select from 4 specialized AI templates to match your learning style.</p>
          </div>
          <div className={styles.templatesGrid}>
            {templates.map((tmpl, i) => (
              <div key={i} className={styles.templateCard}>
                <div className={styles.templateHeader}>
                  <span className={styles.templateIcon}>{tmpl.icon}</span>
                  <h3 className={styles.templateLabel}>{tmpl.label}</h3>
                </div>
                <p className={styles.templateDesc}>{tmpl.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container">
        <div className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <span className="badge badge-purple">❓ Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map((faq, i) => (
              <div key={i} className={styles.faqItem}>
                <h3 className={styles.faqQuestion}>{faq.q}</h3>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container">
        <div className={styles.ctaSection}>
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to ace your classes?</h2>
            <p className={styles.ctaDesc}>
              Join the StudySnap private beta today and turn your lectures into
              perfect grades. No credit card, no signups required.
            </p>
            <div className={styles.downloadBadges}>
              <a href="#" className={styles.downloadBtn}>
                <span className={styles.btnIcon}>🤖</span>
                <span className={styles.btnText}>
                  <span className={styles.btnSub}>Get the package</span>
                  <span className={styles.btnLabel}>Android APK</span>
                </span>
              </a>
              <a href="#" className={styles.downloadBtn}>
                <span className={styles.btnIcon}>🍏</span>
                <span className={styles.btnText}>
                  <span className={styles.btnSub}>Join beta</span>
                  <span className={styles.btnLabel}>iOS TestFlight</span>
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
