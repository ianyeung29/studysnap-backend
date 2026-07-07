import styles from "./LoadingAnimation.module.css";

interface LoadingAnimationProps {
  size?: "sm" | "lg";
  label?: string;
}

export default function LoadingAnimation({
  size = "lg",
  label,
}: LoadingAnimationProps) {
  return (
    <div className={`${styles.wrapper} ${styles[size]}`}>
      <div className={styles.dots}>
        <span />
        <span />
        <span />
      </div>
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}
