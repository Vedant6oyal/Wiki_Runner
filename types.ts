
export type SolverType = 'GEMINI' | 'VECTORS' | 'OPENAI' | 'CLAUDE';

export interface WikiPage {
  title: string;
  summary: string;
  links: string[];
  extract?: string;
}

export interface GameStep {
  pageTitle: string;
  thought: string;
  timestamp: number;
  duration: number; // Execution time in ms
  solver: SolverType;
}

export enum GameStatus {
  IDLE = 'IDLE',
  STARTING = 'STARTING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  LOADING_STEP = 'LOADING_STEP'
}

export interface AIResponse {
  reasoning: string;
  selectedLink: string;
}
