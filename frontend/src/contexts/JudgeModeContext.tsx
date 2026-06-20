"use client";

import React, { createContext, useContext, useState } from "react";

interface JudgeModeContextType {
  isJudgeMode: boolean;
  setIsJudgeMode: (value: boolean) => void;
}

const JudgeModeContext = createContext<JudgeModeContextType | undefined>(undefined);

export function JudgeModeProvider({ children }: { children: React.ReactNode }) {
  const [isJudgeMode, setIsJudgeMode] = useState(false);

  return (
    <JudgeModeContext.Provider value={{ isJudgeMode, setIsJudgeMode }}>
      {children}
    </JudgeModeContext.Provider>
  );
}

export function useJudgeMode() {
  const context = useContext(JudgeModeContext);
  if (context === undefined) {
    throw new Error("useJudgeMode must be used within a JudgeModeProvider");
  }
  return context;
}
