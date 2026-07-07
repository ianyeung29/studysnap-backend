"use client";

import { useState, useRef, useCallback } from "react";
import styles from "./page.module.css";
import { TemplateId } from "@/lib/templates";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TemplateSelector from "@/components/TemplateSelector";
import ResultPanel from "@/components/ResultPanel";
import LoadingAnimation from "@/components/LoadingAnimation";
import HeroSection from "@/components/HeroSection";
import HowItWorks from "@/components/HowItWorks";

interface GenerationResult {
  title: string;
  content: string;
  templateId: TemplateId;
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateId>("study-guide");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<HTMLElement>(null);

  const handleGenerate = useCallback(async () => {
    if (!notes.trim()) {
      setError("Please paste your lecture notes first.");
      return;
    }
    if (notes.trim().length < 50) {
      setError("Notes are too short. Please paste a bit more content.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, templateId: selectedTemplate }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate study materials.");
      }

      setResult({
        title: data.title,
        content: data.content,
        templateId: selectedTemplate,
      });

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [notes, selectedTemplate]);

  const handleScrollToTool = () => {
    toolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const charCount = notes.length;
  const charLimit = 30000;
  const charPercent = Math.min((charCount / charLimit) * 100, 100);

  return (
    <>
      <Navbar />

      <main>
        {/* Hero */}
        <HeroSection onGetStarted={handleScrollToTool} />

        {/* Main Tool */}
        <section ref={toolRef} id="tool" className={styles.toolSection}>
          <div className="container-narrow">
            <div className={styles.toolHeader}>
              <span className="badge badge-purple">✨ Free to use</span>
              <h2>Generate Your Study Materials</h2>
              <p>Paste your notes, pick a format, and let AI do the heavy lifting.</p>
            </div>

            <div className={styles.toolGrid}>
              {/* Left: Input */}
              <div className={styles.inputPanel}>
                <div className={styles.panelLabel}>
                  <span>📋</span> Your Lecture Notes
                </div>
                <textarea
                  className={`textarea ${styles.notesTextarea}`}
                  placeholder={`Paste your lecture notes here...

Example:
Today we covered photosynthesis. It's the process by which plants convert sunlight into energy. 
The equation is: 6CO2 + 6H2O + light → C6H12O6 + 6O2

Light reactions occur in the thylakoid membrane and produce ATP and NADPH...`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={18}
                  maxLength={charLimit}
                />
                <div className={styles.charCounter}>
                  <span
                    style={{
                      color:
                        charPercent > 90
                          ? "var(--color-error)"
                          : "var(--color-text-muted)",
                    }}
                  >
                    {charCount.toLocaleString()} / {charLimit.toLocaleString()} characters
                  </span>
                  <div className={styles.charBar}>
                    <div
                      className={styles.charBarFill}
                      style={{
                        width: `${charPercent}%`,
                        background:
                          charPercent > 90
                            ? "var(--color-error)"
                            : "var(--gradient-primary)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Right: Template + Generate */}
              <div className={styles.rightPanel}>
                <div className={styles.panelLabel}>
                  <span>🎨</span> Choose Your Output Format
                </div>
                <TemplateSelector
                  selected={selectedTemplate}
                  onSelect={setSelectedTemplate}
                />

                {error && (
                  <div className={styles.errorBox}>
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button
                  className={`btn btn-primary btn-lg ${styles.generateBtn}`}
                  onClick={handleGenerate}
                  disabled={isLoading || !notes.trim()}
                  id="generate-button"
                >
                  {isLoading ? (
                    <>
                      <LoadingAnimation size="sm" />
                      Generating...
                    </>
                  ) : (
                    <>✨ Generate Study Materials</>
                  )}
                </button>

                <p className={styles.privacyNote}>
                  🔒 Your notes are never stored. They&apos;re sent to AI and immediately discarded.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Loading state */}
        {isLoading && (
          <section className={styles.loadingSection}>
            <div className="container-narrow">
              <LoadingAnimation size="lg" label="AI is reading your notes..." />
            </div>
          </section>
        )}

        {/* Results */}
        {result && !isLoading && (
          <section ref={resultRef} id="result" className={styles.resultSection}>
            <div className="container-narrow">
              <ResultPanel
                title={result.title}
                content={result.content}
                templateId={result.templateId}
                onRegenerate={handleGenerate}
              />
            </div>
          </section>
        )}

        {/* How It Works */}
        <HowItWorks />
      </main>

      <Footer />
    </>
  );
}
