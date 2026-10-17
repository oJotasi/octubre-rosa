export type PublicQuestion = { id: string; text: string; options: string[] };
export type Game = { sessionId: string; questions: PublicQuestion[]; expiresAt: number };
export type Feedback = { selectedIndex: number; correctIndex: number; isCorrect: boolean; explanation: string };
export type Result = { sessionId: string; correctCount: number; isCorrect: boolean; completedAt: number };
export type SavedGame = { game: Game; answers: (number | null)[]; feedback: (Feedback | null)[]; index: number; result: Result | null; finishing: boolean };
export type Stats = { total: number; correct: number; incorrect: number; correctPercentage: number };
