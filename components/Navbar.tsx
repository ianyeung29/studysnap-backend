import styles from "./Navbar.module.css";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="StudySnap Logo"
            width={28}
            height={28}
            className={styles.logoImg}
          />
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
