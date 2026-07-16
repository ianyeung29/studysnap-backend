"use client";

import { useEffect, useState } from "react";
import { supabaseWeb } from "@/lib/supabase-web";
import styles from "./dashboard.module.css";
import Image from "next/image";

interface Session {
  id: string;
  title: string;
  course: string;
  parent_folder: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  artifact_json: any;
  document_notes: any;
}

interface ChatMessage {
  sender: "user" | "assistant";
  text: string;
}

export default function DashboardPage() {
  const [session, setSession] = useState<any>(null); // Active supabase session
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form Inputs
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Dashboard Data States
  const [sessions, setSessions] = useState<Session[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Active Session Sub-View Tab
  const [activeTab, setActiveTab] = useState<"summary" | "flashcards" | "quiz" | "slides">("summary");
  
  // Interactive Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Interactive Quiz state
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, number>>({});

  // AI Tutor state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [tutorLoading, setTutorLoading] = useState(false);

  // 1. Auth state listener
  useEffect(() => {
    supabaseWeb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabaseWeb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch Sessions when session token changes
  useEffect(() => {
    if (session) {
      fetchSessions();
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [session]);

  const fetchSessions = async () => {
    if (!session) return;
    setDataLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setDataLoading(false);
    }
  };

  // Auth Operations
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (isSignUp) {
        const { error } = await supabaseWeb.auth.signUp({ email, password });
        if (error) throw error;
        alert("Registration successful! Check your email for confirmation.");
      } else {
        const { error } = await supabaseWeb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || "Authentication failed.");
    }
  };

  const handleOAuthSignIn = async () => {
    try {
      await supabaseWeb.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/dashboard",
        },
      });
    } catch (err: any) {
      setAuthError("OAuth redirection failed.");
    }
  };

  const handleSignOut = async () => {
    await supabaseWeb.auth.signOut();
  };

  // Select session helper
  const handleSelectSession = (s: Session) => {
    setSelectedSession(s);
    setActiveTab("summary");
    setCardIndex(0);
    setIsFlipped(false);
    setSelectedQuizAnswers({});
    
    // Set initial welcome tutor message
    setChatMessages([
      {
        sender: "assistant",
        text: `Hi! I am your AI Study Tutor. Ask me anything about "${s.title}". I can clarify slides, explain equations, or run mock study questions!`,
      },
    ]);
  };

  // Send message to AI Tutor
  const handleSendTutorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSession || tutorLoading) return;

    const userMsg = chatInput;
    setChatInput("");
    
    const newMessages = [...chatMessages, { sender: "user" as const, text: userMsg }];
    setChatMessages(newMessages);
    setTutorLoading(true);

    try {
      const res = await fetch("/api/session-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId: selectedSession.id,
          message: userMsg,
          chatHistory: newMessages,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setChatMessages([...newMessages, { sender: "assistant", text: data.text }]);
      } else {
        setChatMessages([...newMessages, { sender: "assistant", text: `Error: ${data.error || "Unable to reach Tutor."}` }]);
      }
    } catch (err) {
      setChatMessages([...newMessages, { sender: "assistant", text: "Connection failed. Please check your internet." }]);
    } finally {
      setTutorLoading(false);
    }
  };

  // Render Markdown helper
  const renderMarkdown = (text: string) => {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$2</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet list items
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    
    // Paragraph splits
    html = html.split('\n\n').map(p => {
      const trimmed = p.trim();
      if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<li')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    }).join('\n');

    return html;
  };

  // Filter sessions based on search query
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.course && s.course.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Render loading screen during Auth state check
  if (authLoading) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.loadingSpinner} style={{ width: "32px", height: "32px" }}></div>
      </div>
    );
  }

  // Render Auth screen if not logged in
  if (!session) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.authCard}>
          <div className={styles.authLogo}>
            <span>📚</span>
            <span>Study<span className="gradient-text">Snap</span></span>
          </div>
          <h2 className={styles.authTitle}>Welcome to StudySnap</h2>
          <p className={styles.authSubtitle}>Review and practice your notes on the desktop</p>

          {authError && <div style={{ color: "#ff4a4a", fontSize: "14px", marginBottom: "16px" }}>{authError}</div>}

          <button className={styles.oauthBtn} onClick={handleOAuthSignIn}>
            <span>🔑</span> Continue with Google
          </button>

          <div className={styles.divider}>or</div>

          <form onSubmit={handleEmailAuth}>
            <div className={styles.formGroup}>
              <label>Email Address</label>
              <input
                type="email"
                required
                className={styles.inputField}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                required
                className={styles.inputField}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className={styles.submitBtn}>
              {isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className={styles.toggleAuthMode} onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Already have an account? " : "New to StudySnap? "}
            <span>{isSignUp ? "Sign In" : "Register"}</span>
          </div>
        </div>
      </div>
    );
  }

  // Render Main Dashboard interface
  return (
    <div className={styles.container}>
      {/* 1. Left Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>
            <span>📚</span> StudySnap
          </div>
        </div>

        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search study guide or course..."
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.sessionsList}>
          {dataLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
              <div className={styles.loadingSpinner}></div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af", fontSize: "14px" }}>
              No study sessions found.
            </div>
          ) : (
            filteredSessions.map((s) => (
              <div
                key={s.id}
                className={`${styles.sessionItem} ${selectedSession?.id === s.id ? styles.activeSessionItem : ""}`}
                onClick={() => handleSelectSession(s)}
              >
                <div className={styles.sessionTitle}>{s.title}</div>
                <div className={styles.sessionMeta}>
                  <span>{s.course || "General"}</span>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.sidebarFooter}>
          <div className={styles.userEmail}>{session.user?.email}</div>
          <button className={styles.signOutBtn} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      {/* 2. Main content view */}
      <div className={styles.mainPanel}>
        {!selectedSession ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>📖</div>
            <h2 className={styles.emptyStateTitle}>Welcome to your StudySnap Portal</h2>
            <p>Select a study session from the sidebar to review your guides, practice quiz, and ask questions to your AI Tutor.</p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div>
                <h1 className={styles.headerTitle}>{selectedSession.title}</h1>
                <div className={styles.headerMeta}>
                  <span className={styles.headerMetaSpan}>📁 {selectedSession.parent_folder || "General Folder"}</span>
                  <span className={styles.headerMetaSpan}>📖 {selectedSession.course || "General Course"}</span>
                  <span className={styles.headerMetaSpan}>📅 {new Date(selectedSession.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className={styles.headerActions}>
                <button className={styles.printBtn} onClick={() => window.print()}>
                  🖨️ Print Note
                </button>
              </div>
            </div>

            <div className={styles.contentArea}>
              {/* Active Tab Subviews */}
              <div className={styles.readingView}>
                <div className={styles.readingWrapper}>
                  <div className={styles.navTabs}>
                    <button
                      className={`${styles.tab} ${activeTab === "summary" ? styles.activeTab : ""}`}
                      onClick={() => setActiveTab("summary")}
                    >
                      📄 Summary
                    </button>
                    <button
                      className={`${styles.tab} ${activeTab === "flashcards" ? styles.activeTab : ""}`}
                      onClick={() => setActiveTab("flashcards")}
                    >
                      🃏 Flashcards
                    </button>
                    <button
                      className={`${styles.tab} ${activeTab === "quiz" ? styles.activeTab : ""}`}
                      onClick={() => setActiveTab("quiz")}
                    >
                      📝 Practice Quiz
                    </button>
                    <button
                      className={`${styles.tab} ${activeTab === "slides" ? styles.activeTab : ""}`}
                      onClick={() => setActiveTab("slides")}
                    >
                      📁 Slide Documents
                    </button>
                  </div>

                  {/* Summary Content */}
                  {activeTab === "summary" && (
                    <div
                      className={styles.markdownContent}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(
                          selectedSession.artifact_json?.content ||
                            selectedSession.artifact_json?.summary ||
                            "No summary text compiled."
                        ),
                      }}
                    ></div>
                  )}

                  {/* Flashcards View */}
                  {activeTab === "flashcards" && (
                    <div className={styles.flashcardsView}>
                      {(!selectedSession.artifact_json?.flashcards || selectedSession.artifact_json.flashcards.length === 0) ? (
                        <div style={{ color: "#9ca3af" }}>No flashcards compiled for this session.</div>
                      ) : (
                        <>
                          <div className={styles.flashcard} onClick={() => setIsFlipped(!isFlipped)}>
                            <div className={styles.cardFace}>
                              {isFlipped
                                ? selectedSession.artifact_json.flashcards[cardIndex]?.back
                                : selectedSession.artifact_json.flashcards[cardIndex]?.front}
                            </div>
                            <div className={styles.cardHint}>
                              {isFlipped ? "Answer (Tap to Flip)" : "Question (Tap to Flip)"}
                            </div>
                          </div>
                          <div className={styles.cardNav}>
                            <button
                              className={styles.navArrowBtn}
                              disabled={cardIndex === 0}
                              onClick={() => {
                                setCardIndex(cardIndex - 1);
                                setIsFlipped(false);
                              }}
                              style={{ opacity: cardIndex === 0 ? 0.3 : 1 }}
                            >
                              ←
                            </button>
                            <span className={styles.cardIndicator}>
                              {cardIndex + 1} / {selectedSession.artifact_json.flashcards.length}
                            </span>
                            <button
                              className={styles.navArrowBtn}
                              disabled={cardIndex === selectedSession.artifact_json.flashcards.length - 1}
                              onClick={() => {
                                setCardIndex(cardIndex + 1);
                                setIsFlipped(false);
                              }}
                              style={{
                                opacity:
                                  cardIndex === selectedSession.artifact_json.flashcards.length - 1 ? 0.3 : 1,
                              }}
                            >
                              →
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Quiz View */}
                  {activeTab === "quiz" && (
                    <div className={styles.quizView}>
                      {(!selectedSession.artifact_json?.quiz || selectedSession.artifact_json.quiz.length === 0) ? (
                        <div style={{ color: "#9ca3af" }}>No practice quiz compiled for this session.</div>
                      ) : (
                        selectedSession.artifact_json.quiz.map((q: any, qIdx: number) => {
                          const isAnswered = selectedQuizAnswers[qIdx] !== undefined;
                          const selectedAnsIdx = selectedQuizAnswers[qIdx];
                          return (
                            <div key={qIdx} className={styles.quizQuestionCard}>
                              <div className={styles.quizQuestionText}>{qIdx + 1}. {q.question}</div>
                              <div>
                                {q.options.map((opt: string, optIdx: number) => {
                                  const isSelected = selectedAnsIdx === optIdx;
                                  const isCorrect = optIdx === q.correctAnswerIndex;
                                  let optionClass = styles.quizOption;
                                  
                                  if (isAnswered) {
                                    if (isCorrect) {
                                      optionClass = `${styles.quizOption} ${styles.quizOptionCorrect}`;
                                    } else if (isSelected) {
                                      optionClass = `${styles.quizOption} ${styles.quizOptionIncorrect}`;
                                    }
                                  } else if (isSelected) {
                                    optionClass = `${styles.quizOption} ${styles.quizOptionSelected}`;
                                  }

                                  return (
                                    <button
                                      key={optIdx}
                                      className={optionClass}
                                      disabled={isAnswered}
                                      onClick={() => {
                                        setSelectedQuizAnswers({
                                          ...selectedQuizAnswers,
                                          [qIdx]: optIdx,
                                        });
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                              {isAnswered && (
                                <div className={styles.quizExplanation}>
                                  <strong>Explanation:</strong> {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Document Slides Text View */}
                  {activeTab === "slides" && (
                    <div className={styles.slidesView}>
                      {(!selectedSession.document_notes || selectedSession.document_notes.length === 0) ? (
                        <div style={{ color: "#9ca3af", textAlign: "center", padding: "40px" }}>
                          No PDF slides or documents uploaded for this session.
                        </div>
                      ) : (
                        selectedSession.document_notes.map((slideText: string, idx: number) => (
                          <div key={idx} className={styles.slideCard}>
                            <div className={styles.slideHeader}>Slide / Page {idx + 1}</div>
                            <div className={styles.slideText}>{slideText}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. AI Tutor Chat Panel */}
              <div className={styles.tutorPanel}>
                <div className={styles.tutorHeader}>
                  <div className={styles.tutorTitle}>
                    <span>🤖</span> AI Study Tutor
                  </div>
                </div>

                <div className={styles.tutorMessages}>
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`${styles.chatBubble} ${
                        msg.sender === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {tutorLoading && (
                    <div
                      className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}
                      style={{ display: "flex", gap: "8px", alignItems: "center" }}
                    >
                      <div className={styles.loadingSpinner}></div>
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>

                <div className={styles.tutorInputArea}>
                  <form onSubmit={handleSendTutorMessage} className={styles.tutorForm}>
                    <input
                      type="text"
                      className={styles.tutorInput}
                      placeholder="Ask a question about this lecture..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className={styles.sendBtn} disabled={tutorLoading}>
                      Ask
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
