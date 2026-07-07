import styles from "./HowItWorks.module.css";

const STEPS = [
  {
    number: "01",
    icon: "📋",
    title: "Paste Your Notes",
    description:
      "Copy your lecture notes, class transcripts, or any text content directly into the box. No formatting needed — messy is fine.",
  },
  {
    number: "02",
    icon: "🎨",
    title: "Choose a Format",
    description:
      "Pick from 6 output formats: Study Guide, Flashcards, Exam Prep, Assignments, Concept Map, or a quick TL;DR summary.",
  },
  {
    number: "03",
    icon: "✨",
    title: "Get Your Study Materials",
    description:
      "AI reads your notes and generates structured, editable study materials in seconds. Edit, copy, or download as PDF.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>
            How <span className="gradient-text">StudySnap</span> works
          </h2>
          <p>Three steps. No sign-up. No cost. No friction.</p>
        </div>

        <div className={styles.steps}>
          {STEPS.map((step, i) => (
            <div key={step.number} className={`card ${styles.step}`}>
              <div className={styles.stepNumber}>{step.number}</div>
              <div className={styles.stepIcon}>{step.icon}</div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDescription}>{step.description}</p>
              {i < STEPS.length - 1 && (
                <div className={styles.connector} aria-hidden>→</div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className={styles.bottomCta}>
          <a href="#tool" className="btn btn-primary btn-lg">
            ✨ Try it now — it&apos;s free
          </a>
          <p className={styles.disclaimer}>
            No account required. Your notes are never stored or used for training.
          </p>
        </div>
      </div>
    </section>
  );
}
