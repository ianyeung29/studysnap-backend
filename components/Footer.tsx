import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            ⚡ Study<span className="gradient-text">Snap</span>
          </span>
          <p className={styles.tagline}>
            Turn messy lecture notes into perfect study materials. Free, fast, private.
          </p>
        </div>

        <div className={styles.links}>
          <a href="#features">Features</a>
          <a href="#download">Download</a>
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>© {new Date().getFullYear()} StudySnap. Built for students, by people who remember the struggle.</p>
        <p className={styles.privacy}>
          🔒 Your notes are never stored or used to train AI models.
        </p>
      </div>
    </footer>
  );
}
