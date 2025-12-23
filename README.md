# 🧠 Wiki Runner AI

> **Autonomous Wikipedia Speedrunning Agent**  
> *Watch AI agents navigate the sum of human knowledge in real-time.*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)
![AI](https://img.shields.io/badge/Powered%20by-LLMs-purple)

## 📖 About

**Wiki Runner AI** is an interactive simulation engine that pits advanced AI models against the classic "Wikipedia Game" (also known as Wiki Speedruns). The goal: navigate from a **Start Page** to a **Target Page** using only internal links, in the fewest steps possible.

I built this project to visualize the reasoning capabilities of different LLMs (Large Language Models) and vector-based search algorithms. It provides a split-screen interface where you can watch the agent's thought process on the left while it autonomously browses a read-only version of Wikipedia on the right.

## ✨ Key Features

- **🤖 Multi-Model Support**:
  - **Gemini 2.0 Flash/Pro**: Leveraging Google's latest multimodal reasoning.
  - **OpenAI GPT-4o**: High-precision navigation.
  - **Claude 4.5 Sonnet/Haiku**: Nuanced semantic understanding.
  - **Vector Embeddings**: Local semantic search using `@xenova/transformers`.
- **🧠 Real-Time Reasoning**: View the agent's internal monologue and "Thought" process for every link choice.
- **⚡ Live Simulation**: Fully autonomous navigation with visual feedback (highlighting selected links).
- **🛡️ Safety Guardrails**:
  - **Auto-Stop Controls**: Instant pause/stop functionality.
  - **Session Timeout**: Automatic 5-minute hard limit to prevent runaway API usage.
  - **Background Pause**: Smartly pauses execution when the tab is inactive.
- **🎨 Modern UI**:
  - Cyberpunk-inspired dark/light hybrid interface.
  - Responsive split-pane layout.
  - Dynamic status indicators and theming per solver.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **AI Integration**: 
  - `@google/genai`
  - `openai`
  - `@anthropic-ai/sdk`
  - `@xenova/transformers` (Client-side embeddings)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- API Keys for the providers you wish to use (Gemini, OpenAI, or Anthropic).

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Vedant6oyal/Wiki_Runner.git
   cd wikispeedrun-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment (Optional)**
   Create a `.env` file in the root directory if you want to hardcode your keys (otherwise, you can enter them in the UI).
   ```bash
   cp .env.example .env
   ```
   
   Add your keys:
   ```env
   GEMINI_API_KEY=your_key_here
   VITE_OPENAI_API_KEY=your_key_here
   VITE_ANTHROPIC_API_KEY=your_key_here
   ```

4. **Start the Dev Server**
   ```bash
   npm start
   ```
   Access the app at `http://localhost:5173`.

## 🎮 How to Play

1. **Select a Solver**: Choose between Gemini, OpenAI, Claude, or Vectors.
2. **Enter API Key**: If not set in `.env`, paste your key in the settings panel.
3. **Select Model**: Choose specific versions (e.g., `gpt-4o-mini` for speed, `claude-sonnet` for reasoning).
4. **Set Coordinates**: Enter a Start Page and a Target Page (or use the Randomize button).
5. **Engage**: Click "Engage" and watch the AI navigate!

## 🧩 Solvers Explained

| Solver | Strengths | Best For |
| :--- | :--- | :--- |
| **Gemini** | Fast, large context window | General speedruns, long distances |
| **OpenAI** | High reasoning accuracy | Complex semantic jumps |
| **Claude** | Natural language nuance | Abstract target concepts |
| **Vectors** | Pure mathematical similarity | Finding direct semantic neighbors (Run locally!) |

## 🛡️ License

This project is open source and available under the [MIT License](LICENSE).

---

*Built by [Vedant Goyal](https://github.com/Vedant6oyal)*
