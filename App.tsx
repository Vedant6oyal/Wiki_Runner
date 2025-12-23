
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameStatus, WikiPage, GameStep, SolverType } from './types';
import * as wikiService from './services/wikiService';
import * as geminiService from './services/geminiService';
import * as openaiService from './services/openaiService';
import * as claudeService from './services/claudeService';
import * as vectorService from './services/vectorService';

// --- Styles ---

const wikiStyles = `
  .wiki-content {
    font-family: sans-serif;
    font-size: 0.95rem;
    line-height: 1.6;
    color: #202122;
  }
  .wiki-content a {
    color: #0645ad;
    text-decoration: none;
    pointer-events: none; /* Prevent user from clicking links manually */
  }
  .wiki-content h1, .wiki-content h2, .wiki-content h3 {
    font-family: 'Linux Libertine', 'Georgia', 'Times', serif;
    border-bottom: 1px solid #a2a9b1;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }
  .wiki-content .infobox {
    float: right;
    margin: 0 0 1em 1em;
    border: 1px solid #a2a9b1;
    background: #f8f9fa;
    padding: 0.5em;
    font-size: 0.85rem;
    max-width: 300px;
    clear: right;
  }
  .wiki-content img {
    max-width: 100%;
    height: auto;
  }
  .wiki-content .thumb {
    margin-bottom: 0.5em;
    border: 1px solid #c8ccd1;
    background-color: #f8f9fa;
    font-size: 0.8rem;
    padding: 3px;
  }
  .wiki-content table {
    background-color: #f8f9fa;
    color: #202122;
    margin: 1em 0;
    border: 1px solid #a2a9b1;
    border-collapse: collapse;
    font-size: 0.85rem;
    width: 100%;
  }
  .wiki-content td, .wiki-content th {
    border: 1px solid #a2a9b1;
    padding: 0.2em 0.4em;
  }
  .wiki-content .mw-empty-elt { display: none; }
  .highlight-link {
    background-color: #fef08a !important;
    border: 2px solid #eab308 !important;
    padding: 2px 4px;
    border-radius: 4px;
    font-weight: bold;
    color: #854d0e !important;
    box-shadow: 0 0 15px rgba(234, 179, 8, 0.4);
    z-index: 10;
    position: relative;
    transition: all 0.3s ease;
  }
  /* Fix for Wikipedia internal references */
  .wiki-content .reflist { font-size: 0.8rem; }
  .wiki-content .navbox { display: none; } /* Hide heavy footers */
`;

// --- Helpers ---

const normalizeTitle = (title: string) => title.trim().replace(/ /g, '_').toLowerCase();

const StepCard: React.FC<{ step: GameStep; index: number }> = ({ step, index }) => {
  const isGemini = step.solver === 'GEMINI';
  const isVectors = step.solver === 'VECTORS';
  const isClaude = step.solver === 'CLAUDE';
  const isOpenAI = step.solver === 'OPENAI';

  let colorClass = 'blue';
  if (isVectors) colorClass = 'purple';
  if (isClaude) colorClass = 'amber';
  if (isOpenAI) colorClass = 'emerald';

  const borderColor = `border-${colorClass}-500`;
  const bgColor = `bg-${colorClass}-500`;
  const textColor = `text-${colorClass}-500`;

  return (
    <div className={`border-l-2 ${borderColor} pl-4 py-3 mb-6 relative group transition-all`}>
      <div className={`absolute -left-[9px] top-4 w-4 h-4 rounded-full ${bgColor} border-2 border-white shadow-sm group-hover:scale-125 transition-transform`}></div>
      <div className="flex justify-between items-center mb-1">
        <div className={`text-[10px] ${textColor} font-black uppercase tracking-widest`}>
          Step {index + 1} • {step.solver}
        </div>
        <div className="text-[10px] text-slate-400 font-mono">
          {step.duration.toFixed(0)}ms
        </div>
      </div>
      <div className="font-bold text-slate-200 leading-tight mb-2">{step.pageTitle}</div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-2.5">
         <p className="text-xs text-slate-400 italic leading-relaxed">
          <i className="fa-solid fa-quote-left text-slate-600 mr-2"></i>
          {step.thought}
        </p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [startPage, setStartPage] = useState('Apollo 11');
  const [targetPage, setTargetPage] = useState('Cheese');
  const [currentWikiPage, setCurrentWikiPage] = useState<WikiPage | null>(null);
  const [history, setHistory] = useState<GameStep[]>([]);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [highlightedLink, setHighlightedLink] = useState<string | null>(null);
  const [maxSteps] = useState(40);
  
  // Solver State
  const [solver, setSolver] = useState<SolverType>('GEMINI');
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash-exp');

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // Track status in a ref to prevent async race conditions when stopping
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Pre-load model if user selects VECTORS
  useEffect(() => {
    if (solver === 'VECTORS' && !isModelReady) {
      setIsModelLoading(true);
      vectorService.loadModel().then(() => {
        setIsModelLoading(false);
        setIsModelReady(true);
      });
    }

    // Set default models when switching solvers
    if (solver === 'GEMINI') setSelectedModel('gemini-2.0-flash-exp');
    if (solver === 'OPENAI') setSelectedModel('gpt-4o-mini');
    if (solver === 'CLAUDE') setSelectedModel('claude-haiku-4-5-20251001');
    
    // Clear API key on solver switch
    setUserApiKey('');
    
  }, [solver, isModelReady]);

  // GUARDRAIL 1: Hard Refresh after 5 minutes to prevent infinite loops/cost
  useEffect(() => {
    const FIVE_MINUTES = 5 * 60 * 1000;
    const timer = setTimeout(() => {
      window.location.reload();
    }, FIVE_MINUTES);
    return () => clearTimeout(timer);
  }, []);

  // GUARDRAIL 2: Auto-pause when tab is hidden (user switches tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && status === GameStatus.PLAYING) {
        setStatus(GameStatus.PAUSED);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status]);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, status]);

  const handleStartGame = async () => {
    try {
      setStatus(GameStatus.STARTING);
      setError(null);
      setHistory([]);
      setHighlightedLink(null);
      
      const page = await wikiService.fetchPageData(startPage);
      setCurrentWikiPage(page);
      setStatus(GameStatus.PLAYING);
    } catch (err: any) {
      setError(`Failed to start: ${err.message}`);
      setStatus(GameStatus.IDLE);
    }
  };

  const resetGame = () => {
    setStatus(GameStatus.IDLE);
    setHistory([]);
    setCurrentWikiPage(null);
    setError(null);
    setHighlightedLink(null);
  };

  const executeMove = useCallback(async () => {
    if (!currentWikiPage || status !== GameStatus.PLAYING) return;

    const currentNorm = normalizeTitle(currentWikiPage.title);
    const targetNorm = normalizeTitle(targetPage);

    if (currentNorm === targetNorm) {
      setStatus(GameStatus.SUCCESS);
      return;
    }

    if (history.length >= maxSteps) {
      setStatus(GameStatus.FAILED);
      setError("Maximum attempts reached without finding the target.");
      return;
    }

    try {
      setStatus(GameStatus.LOADING_STEP);
      
      const startTime = performance.now();
      
      // Select Service
      let move;
      if (solver === 'VECTORS') {
         move = await vectorService.getNextMove(
           currentWikiPage, 
           targetPage, 
           history.map(h => h.pageTitle)
         );
      } else if (solver === 'OPENAI') {
        move = await openaiService.getNextMove(
          currentWikiPage,
          targetPage,
          history.map(h => h.pageTitle),
          userApiKey,
          selectedModel
        );
      } else if (solver === 'CLAUDE') {
        move = await claudeService.getNextMove(
          currentWikiPage,
          targetPage,
          history.map(h => h.pageTitle),
          userApiKey,
          selectedModel
        );
      } else {
         move = await geminiService.getNextMove(
          currentWikiPage,
          targetPage,
          history.map(h => h.pageTitle),
          userApiKey,
          selectedModel
        );
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Visual Highlight
      setHighlightedLink(move.selectedLink);
      
      const newStep: GameStep = {
        pageTitle: currentWikiPage.title,
        thought: move.reasoning,
        timestamp: Date.now(),
        duration: duration,
        solver: solver
      };
      
      setHistory(prev => [...prev, newStep]);

      // Delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (normalizeTitle(move.selectedLink) === targetNorm) {
          const finalPage = await wikiService.fetchPageData(move.selectedLink);
          setCurrentWikiPage(finalPage);
          setHighlightedLink(null);
          setStatus(GameStatus.SUCCESS);
          return;
      }

      // Check if user stopped/paused while we were waiting
      if (statusRef.current === GameStatus.PAUSED) {
        // Apply the move result but stay paused
        const nextPage = await wikiService.fetchPageData(move.selectedLink);
        setCurrentWikiPage(nextPage);
        setHighlightedLink(null);
        return;
      }

      const nextPage = await wikiService.fetchPageData(move.selectedLink);
      setCurrentWikiPage(nextPage);
      setHighlightedLink(null);
      
      setStatus(GameStatus.PLAYING);
    } catch (err: any) {
      console.error(err);
      setError(`Solver Error: ${err.message}`);
      setStatus(GameStatus.FAILED);
    }
  }, [currentWikiPage, targetPage, history, maxSteps, status, solver]);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      const timer = setTimeout(executeMove, 100);
      return () => clearTimeout(timer);
    }
  }, [status, executeMove]);

  // Handle link highlighting in the DOM
  useEffect(() => {
    if (highlightedLink && contentRef.current) {
      const links = contentRef.current.querySelectorAll('a');
      let found = false;
      links.forEach(a => {
        const titleAttr = a.getAttribute('title');
        const textContent = a.textContent?.trim();
        const isMatch = (titleAttr && normalizeTitle(titleAttr) === normalizeTitle(highlightedLink)) ||
                        (textContent && normalizeTitle(textContent) === normalizeTitle(highlightedLink));

        if (isMatch && !found) {
          a.classList.add('highlight-link');
          a.scrollIntoView({ behavior: 'smooth', block: 'center' });
          found = true;
        } else {
          a.classList.remove('highlight-link');
        }
      });
    }
  }, [highlightedLink, currentWikiPage]);

  // Reset scroll on page change
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
    }
  }, [currentWikiPage?.title]);

  const getAvgTime = () => {
    if (history.length === 0) return 0;
    const total = history.reduce((acc, step) => acc + step.duration, 0);
    return Math.round(total / history.length);
  };

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-slate-100 text-slate-900">
      <style>{wikiStyles}</style>

      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2 rounded-lg flex items-center justify-center w-10 h-10 shadow-lg">
            <i className="fa-brands fa-wikipedia-w text-xl"></i>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">WIKI RUNNER</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Autonomous AI Simulation</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8 bg-slate-50 border border-slate-100 rounded-full px-6 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Start</span>
            <span className="text-sm font-bold text-slate-700 max-w-[120px] truncate">{startPage}</span>
          </div>
          <i className="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Goal</span>
            <span className="text-sm font-bold text-blue-600 max-w-[120px] truncate">{targetPage}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-400 uppercase leading-none">Path</div>
            <div className="text-xl font-mono font-bold text-slate-900">
              {history.length}
              <span className="text-slate-300 mx-1">/</span>
              <span className="text-slate-400 text-sm">{maxSteps}</span>
            </div>
          </div>
          {status !== GameStatus.IDLE && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setStatus(prev => prev === GameStatus.PAUSED ? GameStatus.PLAYING : GameStatus.PAUSED)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border shadow-sm active:scale-90
                  ${status === GameStatus.PAUSED 
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-100' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100'}`}
                title={status === GameStatus.PAUSED ? "Resume Mission" : "Stop Mission"}
              >
                <i className={`fa-solid ${status === GameStatus.PAUSED ? 'fa-play' : 'fa-stop'}`}></i>
              </button>

              <button 
                onClick={resetGame}
                className="bg-red-50 hover:bg-red-100 text-red-600 w-10 h-10 rounded-full flex items-center justify-center transition-all border border-red-100 shadow-sm hover:rotate-90 active:scale-90"
                title="Abort & Return Home"
              >
                <i className="fa-solid fa-house"></i>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area - Split View */}
      <main className="relative flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Left Sidebar: Log & Config */}
        <section className={`
          flex flex-col z-40 shadow-2xl overflow-hidden shrink-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
          bg-slate-900 md:bg-slate-900
          md:w-[380px] md:relative md:inset-auto md:h-auto md:border-r md:border-slate-800 md:rounded-none md:shadow-none
          ${status === GameStatus.IDLE 
            ? 'absolute inset-0 w-full h-full' 
            : `absolute bottom-0 left-0 right-0 rounded-t-3xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] bg-slate-900/80 backdrop-blur-xl ${isChatMinimized ? 'h-16' : 'h-[50vh]'}`
          }
        `}>
          {status === GameStatus.IDLE ? (
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="space-y-2">
                <h2 className="text-white text-xl font-bold">Mission Config</h2>
                <p className="text-slate-500 text-[11px] leading-relaxed uppercase font-black tracking-widest">Select Solver & Coordinates</p>
              </div>

              {/* Solver Selection */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800 rounded-xl p-2">
                <button 
                  onClick={() => setSolver('GEMINI')}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex flex-col items-center justify-center gap-1
                    ${solver === 'GEMINI' ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                >
                  <i className="fa-solid fa-brain text-sm"></i>
                  Gemini
                </button>
                <button 
                  onClick={() => setSolver('OPENAI')}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex flex-col items-center justify-center gap-1
                    ${solver === 'OPENAI' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                >
                  <i className="fa-solid fa-bolt text-sm"></i>
                  OpenAI
                </button>
                <button 
                  onClick={() => setSolver('CLAUDE')}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex flex-col items-center justify-center gap-1
                    ${solver === 'CLAUDE' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}`}
                >
                  <i className="fa-solid fa-robot text-sm"></i>
                  Claude
                </button>
                <button 
                  onClick={() => setSolver('VECTORS')}
                  disabled={isModelLoading}
                  className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex flex-col items-center justify-center gap-1
                    ${solver === 'VECTORS' ? 'bg-purple-600 text-white shadow-lg' : 'bg-slate-700/50 text-slate-500 hover:bg-slate-700 hover:text-slate-300'}
                    ${isModelLoading ? 'opacity-50 cursor-wait' : ''}
                  `}
                >
                  {isModelLoading ? (
                    <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                  ) : (
                    <i className="fa-solid fa-bezier-curve text-sm"></i>
                  )}
                  Vectors
                </button>
              </div>

              {solver !== 'VECTORS' && (
                <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">{solver} API Key <span className="text-slate-600 font-normal normal-case tracking-normal">(Optional)</span></label>
                    <input 
                      type="password"
                      placeholder="Use env key or paste here..."
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">Model Selection</label>
                    <div className="relative">
                      <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full appearance-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {solver === 'GEMINI' && (
                          <>
                            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Preview)</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro (Reasoning)</option>
                            <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash-8B (Light)</option>
                          </>
                        )}
                        {solver === 'OPENAI' && (
                          <>
                            <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                            <option value="gpt-4o">GPT-4o (Smart)</option>
                            <option value="gpt-5-mini">GPT-5 Mini (Preview)</option>
                           
                          </>
                        )}
                        {solver === 'CLAUDE' && (
                          <>
                            <option value="claude-sonnet-4-5-20250929">Claude 4.5 Sonnet (Latest and smartest)</option>
                            <option value="claude-sonnet-4-20250514">Claude 4 Sonnet (Smart)</option>
                            <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku (Fast)</option>
                          </>
                        )}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                        <i className="fa-solid fa-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">Origin Coordinate</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                    <button onClick={() => wikiService.fetchRandomPageTitle().then(setStartPage)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                      <i className="fa-solid fa-shuffle text-sm"></i>
                    </button>
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">Target Objective</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={targetPage}
                      onChange={(e) => setTargetPage(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                    <button onClick={() => wikiService.fetchRandomPageTitle().then(setTargetPage)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                      <i className="fa-solid fa-shuffle text-sm"></i>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleStartGame}
                  className={`w-full font-black py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] uppercase tracking-[0.2em] text-white
                    ${solver === 'GEMINI' ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40' : ''}
                    ${solver === 'VECTORS' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40' : ''}
                    ${solver === 'OPENAI' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40' : ''}
                    ${solver === 'CLAUDE' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40' : ''}
                  `}
                >
                  Engage {solver}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div 
                className="p-5 border-b border-white/5 shrink-0 cursor-pointer md:cursor-default"
                onClick={() => setIsChatMinimized(!isChatMinimized)}
              >
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <button className="md:hidden text-slate-400 hover:text-white transition-colors">
                        <i className={`fa-solid fa-chevron-${isChatMinimized ? 'up' : 'down'}`}></i>
                     </button>
                     <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decision Pipeline</h2>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${status === GameStatus.PLAYING ? (solver === 'GEMINI' ? 'bg-blue-500' : 'bg-purple-500') + ' animate-pulse' : (status === GameStatus.PAUSED ? 'bg-amber-500' : 'bg-slate-700')}`}></span>
                     <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">
                       {status === GameStatus.LOADING_STEP ? 'Computing...' : (status === GameStatus.PAUSED ? 'Paused' : 'Active')}
                     </span>
                   </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-1 bg-slate-900/50 scroll-smooth custom-scrollbar" ref={scrollRef}>
                {history.map((step, idx) => (
                  <StepCard key={idx} step={step} index={idx} />
                ))}
                
                {status === GameStatus.LOADING_STEP && (
                  <div className={`
                    bg-${solver === 'GEMINI' ? 'blue' : solver === 'OPENAI' ? 'emerald' : solver === 'CLAUDE' ? 'amber' : 'purple'}-500/5 
                    border border-${solver === 'GEMINI' ? 'blue' : solver === 'OPENAI' ? 'emerald' : solver === 'CLAUDE' ? 'amber' : 'purple'}-500/20 
                    rounded-xl p-4 animate-pulse
                  `}>
                    <div className={`flex items-center gap-3 text-${solver === 'GEMINI' ? 'blue' : solver === 'OPENAI' ? 'emerald' : solver === 'CLAUDE' ? 'amber' : 'purple'}-400 mb-2`}>
                      <i className={`fa-solid ${solver === 'VECTORS' ? 'fa-bezier-curve' : 'fa-microchip'} text-xs`}></i>
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {solver === 'VECTORS' ? 'Calculating Vectors...' : 'Reasoning...'}
                      </span>
                    </div>
                    <div className={`h-2 bg-${solver === 'GEMINI' ? 'blue' : solver === 'OPENAI' ? 'emerald' : solver === 'CLAUDE' ? 'amber' : 'purple'}-500/20 rounded-full w-full mb-2`}></div>
                    <div className={`h-2 bg-${solver === 'GEMINI' ? 'blue' : solver === 'OPENAI' ? 'emerald' : solver === 'CLAUDE' ? 'amber' : 'purple'}-500/20 rounded-full w-2/3`}></div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Content Area: Wikipedia */}
        <section className="flex-1 overflow-hidden flex flex-col relative bg-[#f8f9fa]">
          
          {/* Status Overlays */}
          {status === GameStatus.SUCCESS && (
            <div className="absolute inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-start pt-24 text-white text-center p-6 backdrop-blur-md animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/50">
                <i className="fa-solid fa-flag-checkered text-4xl"></i>
              </div>
              <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase italic">Target Acquired</h2>
              <div className="flex gap-8 my-8 text-center">
                <div>
                   <div className="text-3xl font-mono font-bold">{history.length}</div>
                   <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Total Steps</div>
                </div>
                <div>
                   <div className="text-3xl font-mono font-bold">{getAvgTime()}ms</div>
                   <div className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Avg Time/Step</div>
                </div>
              </div>
              <div className="text-lg text-slate-300 max-w-md font-medium mb-10">
                The <strong className={`
                  ${solver === 'GEMINI' ? 'text-blue-400' : ''}
                  ${solver === 'VECTORS' ? 'text-purple-400' : ''}
                  ${solver === 'OPENAI' ? 'text-emerald-400' : ''}
                  ${solver === 'CLAUDE' ? 'text-amber-400' : ''}
                `}>{solver}</strong> solver successfully navigated to "{targetPage}".
              </div>
              <button 
                onClick={resetGame}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                New Mission
              </button>
            </div>
          )}

          {status === GameStatus.FAILED && (
            <div className="absolute inset-0 z-50 bg-red-950/95 flex flex-col items-center justify-start pt-24 text-white text-center p-6 backdrop-blur-md animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-red-500/50">
                <i className="fa-solid fa-circle-exclamation text-4xl"></i>
              </div>
              <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase italic">Mission Failed</h2>
              <p className="text-lg text-slate-300 max-w-md mb-10">{error}</p>
              <button 
                onClick={resetGame}
                className="bg-white text-slate-900 px-12 py-4 rounded-full font-black uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
              >
                Reset System
              </button>
            </div>
          )}

          {currentWikiPage ? (
            <div className="flex-1 overflow-y-auto scroll-smooth" id="wiki-viewport" ref={viewportRef}>
              <div className="p-8 md:p-14 max-w-4xl mx-auto bg-white shadow-sm min-h-full border-x border-slate-200">
                <div className="mb-10 border-b border-slate-100 pb-6">
                   <h1 className="text-4xl font-serif text-[#000] mb-2 leading-tight">
                    {currentWikiPage.title}
                  </h1>
                  <div className="text-[13px] text-[#54595d]">From Wikipedia, the free encyclopedia</div>
                </div>

                <div 
                  ref={contentRef}
                  className="wiki-content"
                  dangerouslySetInnerHTML={{ __html: currentWikiPage.extract || '' }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
              {status === GameStatus.STARTING ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
                  <p className="font-mono text-xs uppercase tracking-widest">Decrypting Page Data...</p>
                </div>
              ) : (
                <div className="max-w-md">
                   <div className="w-20 h-20 bg-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <i className="fa-solid fa-satellite text-3xl text-slate-400"></i>
                   </div>
                   <h2 className="text-xl font-bold text-slate-800 mb-2">Offline Navigation</h2>
                   <p className="text-sm">Select a solver mode and coordinates to begin.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      
      {/* Footer / Ticker */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-600 px-6 py-2 text-[9px] font-mono flex items-center justify-between z-30 shrink-0">
        <div className="flex gap-4 uppercase tracking-widest font-black">
          <span className="flex items-center gap-2">
             <span className={`w-1.5 h-1.5 rounded-full 
               ${solver === 'GEMINI' ? 'bg-blue-500' : ''}
               ${solver === 'VECTORS' ? 'bg-purple-500' : ''}
               ${solver === 'OPENAI' ? 'bg-emerald-500' : ''}
               ${solver === 'CLAUDE' ? 'bg-amber-500' : ''}
             `}></span>
             Solver: {solver}
          </span>
          <span className="flex items-center gap-2">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
             Status: {status === GameStatus.LOADING_STEP ? 'Computing' : 'Ready'}
          </span>
        </div>
        <div className="opacity-50">
          DESIGNATED FOR AUTONOMOUS EXPLORATION ONLY
        </div>
      </footer>
    </div>
  );
}
