import styles from "./HeroSection.module.css";

interface HeroSectionProps {
  onGetStarted: () => void;
}

const STATS = [
  { value: "6", label: "Study formats" },
  { value: "~5s", label: "To generate" },
  { value: "100%", label: "Free to use" },
  { value: "0", label: "Sign-ups needed" },
];

export default function HeroSection({ onGetStarted }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      {/* Background glow */}
      <div className={styles.glow} aria-hidden />
      <div className={styles.glowRight} aria-hidden />

      <div className={`container ${styles.inner}`}>
        <div className={styles.content}>
          <span className={`badge badge-purple ${styles.heroBadge}`}>
            <span className={styles.badgeDot} />
            AI-powered · Free · No sign-up
          </span>

          <h1 className={styles.headline}>
            Turn messy lecture notes into{" "}
            <span className="gradient-text">perfect study materials</span>
          </h1>

          <p className={styles.subheadline}>
            Paste your notes. Get a study guide, flashcards, exam questions, and more — 
            in seconds. Built for students who want to study smarter, not harder.
          </p>

          <div className={styles.ctas}>
            <button
              className={`btn btn-primary btn-lg`}
              onClick={onGetStarted}
              id="hero-cta-button"
            >
              ✨ Try it free — no sign-up
            </button>
            <a href="#how-it-works" className={`btn btn-secondary`}>
              See how it works
            </a>
          </div>

          {/* Stats */}
          <div className={styles.stats}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.stat}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview card */}
        <div className={styles.preview} aria-hidden>
          <div className={`card ${styles.previewCard}`}>
            <div className={styles.previewHeader}>
              <div className={styles.dots}>
                <span />
                <span />
                <span />
              </div>
              <span className={styles.previewTitle}>Study Guide — Biology 101</span>
            </div>
            <div className={styles.previewBody}>
              <div className={styles.previewLine} style={{ width: "90%" }} />
              <div className={styles.previewLine} style={{ width: "75%" }} />
              <div className={styles.previewLine} style={{ width: "85%" }} />
              <div className={styles.previewSpacer} />
              <div className={styles.previewChip}>📌 Key Concept</div>
              <div className={styles.previewLine} style={{ width: "70%" }} />
              <div className={styles.previewLine} style={{ width: "88%" }} />
              <div className={styles.previewSpacer} />
              <div className={styles.previewChip}>✅ Action Item</div>
              <div className={styles.previewLine} style={{ width: "60%" }} />
            </div>
          </div>

          <div className={`${styles.floatingBadge} ${styles.badge1}`}>
            🃏 Flashcards ready
          </div>
          <div className={`${styles.floatingBadge} ${styles.badge2}`}>
            🎯 Exam prep generated
          </div>
        </div>
      </div>
    </section>
  );
}
