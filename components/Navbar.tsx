import styles from "./Navbar.module.css";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          <span className={styles.logoText}>
            Study<span className="gradient-text">Snap</span>
          </span>
        </Link>

        <div className={styles.actions}>
          <a href="#download" className={`btn btn-ghost ${styles.ctaBtn}`}>
            Download
          </a>
        </div>
      </div>
    </nav>
  );
}
