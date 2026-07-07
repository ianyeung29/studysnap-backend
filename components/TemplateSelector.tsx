"use client";
import { TemplateId, TEMPLATES } from "@/lib/templates";
import styles from "./TemplateSelector.module.css";

interface TemplateSelectorProps {
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
}

export default function TemplateSelector({
  selected,
  onSelect,
}: TemplateSelectorProps) {
  return (
    <div className={styles.grid}>
      {(Object.entries(TEMPLATES) as [TemplateId, typeof TEMPLATES[TemplateId]][]).map(
        ([id, template]) => (
          <button
            key={id}
            className={`${styles.card} ${selected === id ? styles.selected : ""}`}
            onClick={() => onSelect(id)}
            type="button"
            id={`template-${id}`}
            aria-pressed={selected === id}
          >
            <span className={styles.icon}>{template.icon}</span>
            <div className={styles.text}>
              <span className={styles.label}>{template.label}</span>
              <span className={styles.description}>{template.description}</span>
            </div>
            {selected === id && (
              <span className={styles.checkmark} aria-hidden>✓</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
