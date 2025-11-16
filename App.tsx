import React, { useState, useEffect, useCallback, useRef, DragEvent } from 'react';
import { LevelConfig, Progress, GameView, PhonicsLevel } from './types';
import { LEVEL_CONFIGS, TOTAL_LEVELS } from './constants';
import { generatePhonicsLevel } from './services/geminiService';

// --- AUDIO SERVICE ---
const audioService = {
  audioCtx: undefined as AudioContext | undefined,
  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  },
  playSound(frequencies: number[], duration = 0.2) {
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);
    oscillator.type = 'sine';

    let currentTime = this.audioCtx.currentTime;
    frequencies.forEach((freq) => {
      oscillator.frequency.setValueAtTime(freq, currentTime);
      gainNode.gain.setValueAtTime(0.3, currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + duration);
      currentTime += duration;
    });

    oscillator.start();
    oscillator.stop(currentTime);
  },
  playCorrect() { this.playSound([261.63, 329.63, 392.00], 0.15); },
  playWrong() { this.playSound([392.00, 329.63, 261.63], 0.2); },
  playCompletion() { this.playSound([261.63, 329.63, 392.00, 523.25], 0.15); },
};

// --- HELPER COMPONENTS (Defined outside main component to prevent re-renders) ---

const StarryBackground: React.FC = () => (
  <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none">
    <div className="absolute top-[10%] left-[10%] text-yellow-300 text-2xl animate-pulse">⭐</div>
    <div className="absolute top-[20%] right-[15%] text-yellow-300 text-2xl animate-pulse delay-500">⭐</div>
    <div className="absolute bottom-[30%] left-[20%] text-yellow-300 text-2xl animate-pulse delay-1000">⭐</div>
    <div className="absolute bottom-[10%] right-[10%] text-yellow-300 text-2xl animate-pulse delay-700">⭐</div>
    <div className="absolute top-[50%] left-[50%] text-yellow-300 text-2xl animate-pulse delay-300">⭐</div>
  </div>
);

interface FeedbackDisplayProps {
  feedback: { message: string; type: 'correct' | 'wrong' | 'sticker' } | null;
}
const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({ feedback }) => {
  if (!feedback) return <div className="h-16"></div>;

  const emojiMap = {
    correct: '😊👍',
    wrong: '😔',
    sticker: '🎉🏆⭐',
  };
  const animationMap = {
    correct: '',
    wrong: 'animate-bounce', // Simple shake effect
    sticker: 'animate-bounce',
  };

  return (
    <div className="flex items-center justify-center text-center text-4xl sm:text-5xl font-bold my-4 min-h-[64px] transition-opacity duration-300">
      <span className={`${animationMap[feedback.type]} inline-block`}>{emojiMap[feedback.type]}</span>
      <span className="ml-4 text-lg text-indigo-800">{feedback.message}</span>
    </div>
  );
};

const AdBanner: React.FC = () => (
    <div className="mt-6 text-center">
        <div className="w-full max-w-lg mx-auto bg-gray-100 border border-gray-300 rounded-lg p-4 h-24 flex items-center justify-center">
            <p className="text-sm text-gray-500">Advertisement Placeholder</p>
            {/* Ad Unit: ca-app-pub-8662489926396482/3004245930 */}
        </div>
    </div>
);

const GameScreenAdBanner: React.FC = () => (
    <div className="mt-8 text-center">
        <div className="w-full max-w-lg mx-auto bg-gray-100 border border-gray-300 rounded-lg p-4 h-24 flex items-center justify-center">
            <div className="text-center">
                <p className="text-sm text-gray-500">Advertisement Placeholder</p>
                <p className="text-xs text-gray-400 mt-2">Ad Unit: ca-app-pub-8662489926396482/4845717313</p>
            </div>
        </div>
    </div>
);

const InterstitialAd: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl relative text-center">
        <div className="absolute top-2 right-2">
          <button onClick={onClose} className="bg-gray-200 text-gray-700 w-10 h-10 rounded-full font-bold flex items-center justify-center">
            {countdown > 0 ? countdown : 'X'}
          </button>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Advertisement</h2>
        <div className="w-full h-64 bg-gray-100 border border-gray-300 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">Interstitial Ad Placeholder</p>
            <p className="text-xs text-gray-400 mt-2">Ad Unit: ca-app-pub-8662489926396482/7471880651</p>
          </div>
        </div>
      </div>
    </div>
  );
};


// --- CUSTOM HOOKS (Defined in the same file for simplicity) ---

const useGameProgress = () => {
  const [progress, setProgress] = useState<Progress>({
    levels: new Array(TOTAL_LEVELS).fill(false),
    avatar: '👦',
    stars: 0,
  });

  useEffect(() => {
    try {
      const savedProgress = localStorage.getItem('magicQuestProgress');
      if (savedProgress) {
        const parsed = JSON.parse(savedProgress);
        // Ensure the levels array is the correct length, expanding it if new levels were added.
        if (parsed.levels.length !== TOTAL_LEVELS) {
            const updatedLevels = new Array(TOTAL_LEVELS).fill(false);
            // Copy over old progress
            for (let i = 0; i < Math.min(parsed.levels.length, TOTAL_LEVELS); i++) {
                updatedLevels[i] = parsed.levels[i];
            }
            parsed.levels = updatedLevels;
        }
        setProgress(parsed);
      }
    } catch (error) {
      console.error("Failed to load progress from localStorage", error);
    }
  }, []);

  const saveProgress = useCallback((newProgress: Progress) => {
    try {
      localStorage.setItem('magicQuestProgress', JSON.stringify(newProgress));
      setProgress(newProgress);
    } catch (error) {
      console.error("Failed to save progress to localStorage", error);
    }
  }, []);

  return { progress, saveProgress };
};

const useSpeechRecognition = (onResult: (transcript: string) => void) => {
    const [isListening, setIsListening] = useState(false);
    // FIX: Use `any` for SpeechRecognition ref to avoid type errors as SpeechRecognition types may not be available.
    const recognitionRef = useRef<any | null>(null);

    useEffect(() => {
        // FIX: Cast window to `any` to access non-standard SpeechRecognition properties.
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech recognition not supported.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            onResult(transcript);
            setIsListening(false);
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
        };
        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, [onResult]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            recognitionRef.current.start();
            setIsListening(true);
        }
    }, [isListening]);

    return { isListening, startListening };
};


// --- UI COMPONENTS ---

const WelcomeScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="text-center">
    <p className="text-lg text-indigo-900 mb-8">
      Welcome to the magical world where letters and numbers unlock enchanted levels! Drag phonics to spell words, match shapes, and solve puzzles. Speak words to practice pronunciation— the magic adapts to you!
    </p>
    <button onClick={onStart} className="bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-bold text-2xl py-4 px-8 rounded-full shadow-lg transform hover:scale-105 transition-transform duration-300">
      Start Your Quest!
    </button>
  </div>
);

const LevelsMenuScreen: React.FC<{
  progress: Progress;
  onSelectLevel: (levelIndex: number) => void;
  onSelectCustomLevel: (level: PhonicsLevel) => void;
}> = ({ progress, onSelectLevel, onSelectCustomLevel }) => (
  <div>
    <h2 className="text-3xl font-bold text-center text-indigo-900 mb-4">Choose Your Adventure</h2>
    <GeminiLevelGenerator onLevelGenerated={onSelectCustomLevel} />
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {LEVEL_CONFIGS.map((level, index) => {
        const isUnlocked = index === 0 || progress.levels[index - 1];
        return (
          <button
            key={index}
            onClick={() => onSelectLevel(index)}
            disabled={!isUnlocked}
            className={`p-4 rounded-lg text-left shadow-md transition-transform transform hover:scale-105
              ${isUnlocked
                ? 'bg-pink-400 hover:bg-pink-500 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
          >
            <span className="font-bold block">Level {index + 1}</span>
            <span className="text-sm">{isUnlocked ? level.description.split('!')[0] : '🔒 Locked'}</span>
          </button>
        );
      })}
    </div>
    <AdBanner />
  </div>
);

const GeminiLevelGenerator: React.FC<{ onLevelGenerated: (level: PhonicsLevel) => void }> = ({ onLevelGenerated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        const newLevel = await generatePhonicsLevel();
        setIsLoading(false);
        if (newLevel) {
            onLevelGenerated(newLevel);
        } else {
            setError("Couldn't create a magical quest. Please try again!");
        }
    };

    return (
        <div className="my-6 p-4 bg-indigo-200/50 rounded-lg text-center">
            <h3 className="text-xl font-bold text-indigo-800">✨ Surprise Quest! ✨</h3>
            <p className="text-indigo-700 my-2">Let magic create a new challenge for you!</p>
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-6 rounded-full shadow-lg transition transform hover:scale-105 disabled:bg-purple-300 disabled:cursor-wait"
            >
                {isLoading ? 'Creating...' : 'Ask the Oracle'}
            </button>
            {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
        </div>
    );
};


const GameScreen: React.FC<{
  level: LevelConfig;
  onComplete: () => void;
  onExit: () => void;
  setFeedback: (feedback: FeedbackDisplayProps['feedback']) => void;
}> = ({ level, onComplete, onExit, setFeedback }) => {
    const [isComplete, setIsComplete] = useState(false);
    const [droppedLetters, setDroppedLetters] = useState<(string | null)[]>([]);
    const [dropResult, setDropResult] = useState<'incorrect' | null>(null);

    useEffect(() => {
        setIsComplete(false);
        const letterCount = (level.type === 'phonics' || level.type === 'sort') ? level.letters?.length || level.items?.length : 0;
        setDroppedLetters(new Array(letterCount).fill(null));
        setDropResult(null);
    }, [level]);

    const handleCorrect = () => {
        if(isComplete) return;
        audioService.playCorrect();
        setFeedback({ message: 'Great job!', type: 'correct' });
        setIsComplete(true);
    };
    
    const handleWrong = (message: string = 'Try again!') => {
        audioService.playWrong();
        setFeedback({ message, type: 'wrong' });
        setDropResult('incorrect');
    };

    const handleCompleteLevel = () => {
        audioService.playCompletion();
        setFeedback({ message: 'Level Complete!', type: 'sticker' });
        setTimeout(onComplete, 1500);
    };

    const handleSpeechResult = useCallback((transcript: string) => {
        if (level.type === 'phonics' && transcript.includes(level.word)) {
            audioService.playCorrect();
            setFeedback({ message: `Perfect! You said "${transcript}"`, type: 'correct' });
        } else {
           handleWrong(`You said "${transcript}". Try saying "${(level as PhonicsLevel).word}"!`);
        }
    }, [level]);
    
    const { isListening, startListening } = useSpeechRecognition(handleSpeechResult);

    const handleDrop = (e: DragEvent<HTMLDivElement>, position: number) => {
        e.preventDefault();
        const letter = e.dataTransfer.getData('text/plain');
        e.currentTarget.classList.remove('bg-indigo-200');
        const newDroppedLetters = [...droppedLetters];
        if (!newDroppedLetters[position]) {
            newDroppedLetters[position] = letter;
            setDroppedLetters(newDroppedLetters);

            if (level.type === 'phonics') {
                const spelledWord = newDroppedLetters.join('').toLowerCase();
                if (spelledWord.length === level.letters.length) {
                    if (spelledWord === level.word) {
                        handleCorrect();
                    } else {
                        handleWrong();
                        setTimeout(() => {
                            setDroppedLetters(new Array(level.letters.length).fill(null));
                            setDropResult(null);
                        }, 1000);
                    }
                }
            } else if (level.type === 'sort') {
                 const isFilled = newDroppedLetters.every(l => l !== null);
                 if (isFilled) {
                    const sorted = [...level.items].sort((a,b) => parseInt(a) - parseInt(b));
                    const droppedNums = newDroppedLetters.map(i => i);
                    if (JSON.stringify(sorted) === JSON.stringify(droppedNums)) {
                        handleCorrect();
                    } else {
                        handleWrong();
                        setTimeout(() => {
                            setDroppedLetters(new Array(level.items.length).fill(null));
                            setDropResult(null);
                        }, 1000);
                    }
                 }
            }
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();
    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => e.currentTarget.classList.add('bg-indigo-200');
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => e.currentTarget.classList.remove('bg-indigo-200');


    const renderActivity = () => {
        switch (level.type) {
            case 'phonics':
            case 'sort':
                const items = level.type === 'phonics' ? level.letters : level.items;
                const shuffledItems = [...items].sort(() => Math.random() - 0.5);
                const slotBg = isComplete ? 'bg-green-300' : dropResult === 'incorrect' ? 'bg-red-300' : 'bg-white';

                return (
                    <div className="text-center">
                        <div className="flex justify-center flex-wrap gap-4 my-6">
                            {shuffledItems.map((item, index) => (
                                <div key={`${item}-${index}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', item)} className="w-16 h-16 sm:w-20 sm:h-20 bg-pink-500 rounded-full flex items-center justify-center text-white text-2xl sm:text-3xl font-bold cursor-move select-none shadow-lg transform active:scale-110 active:rotate-6 transition-transform">
                                    {item}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-center items-center gap-2 sm:gap-4 my-6 h-24 sm:h-28 p-2 border-4 border-dashed border-indigo-400 rounded-2xl bg-white/50">
                            {items.map((_, index) => (
                                <div key={index} onDrop={(e) => handleDrop(e, index)} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                                    className={`w-16 h-16 sm:w-20 sm:h-20 border-2 border-yellow-400 rounded-lg flex items-center justify-center text-2xl sm:text-3xl font-bold transition-colors duration-200 ${slotBg}`}>
                                    {droppedLetters[index]}
                                </div>
                            ))}
                        </div>
                    </div>
                );
             case 'shape':
                const shapeOptions = ['🔵', '🔴', '🟡', '🟢', '🔺', '🔲', '⭐', '❤️', '💎', '🌙'].sort(() => Math.random() - 0.5).slice(0, 5);
                if (!shapeOptions.includes(level.shape)) {
                    shapeOptions[Math.floor(Math.random() * shapeOptions.length)] = level.shape;
                }
                return (
                    <div className="text-center">
                        <div className="text-8xl my-6">{level.shape}</div>
                        <div className="flex justify-center flex-wrap gap-4">
                            {shapeOptions.map(opt => (
                                <button key={opt} onClick={() => opt === level.shape ? handleCorrect() : handleWrong()} className="text-5xl p-4 bg-white/70 rounded-lg shadow-md transform hover:scale-110 transition-transform">
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 'number':
                return (
                    <div className="text-center">
                        <div className="text-5xl my-6 tracking-widest">{level.stars}</div>
                        <form onSubmit={(e) => { e.preventDefault(); const input = (e.target as HTMLFormElement).elements.namedItem('numberInput') as HTMLInputElement; parseInt(input.value) === level.num ? handleCorrect() : handleWrong(); }}>
                            <input id="numberInput" type="number" min="1" max="30" required className="text-2xl p-3 w-32 text-center rounded-lg border-2 border-indigo-300 focus:border-indigo-500 focus:ring-indigo-500"/>
                            <button type="submit" className="ml-4 bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-bold py-3 px-6 rounded-lg shadow-md">Check!</button>
                        </form>
                    </div>
                );
            case 'color':
                const colorMap: { [key: string]: string } = { red: 'bg-red-500', blue: 'bg-blue-500', yellow: 'bg-yellow-400', green: 'bg-green-500', purple: 'bg-purple-500', orange: 'bg-orange-500', pink: 'bg-pink-400', black: 'bg-black', white: 'bg-white border-2 border-gray-300', brown: 'bg-yellow-900' };
                const colorOptions = ['red', 'blue', 'yellow', 'green', 'purple', 'orange', 'pink', 'black', 'white', 'brown'].sort(() => Math.random() - 0.5).slice(0, 5);
                 if (!colorOptions.includes(level.name)) {
                    colorOptions[Math.floor(Math.random() * colorOptions.length)] = level.name;
                }
                return (
                     <div className="text-center">
                        <div className="text-8xl my-6">{level.emoji}</div>
                        <div className="flex justify-center flex-wrap gap-4">
                             {colorOptions.map(color => (
                                <button key={color} onClick={() => color === level.name ? handleCorrect() : handleWrong()} className={`w-20 h-20 rounded-full shadow-lg transform hover:scale-110 transition-transform ${colorMap[color]}`}>
                                </button>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="relative">
            <button onClick={onExit} className="absolute top-0 left-0 bg-pink-400 hover:bg-pink-500 text-white font-bold py-1 px-3 rounded-full text-sm">
                &larr; Levels
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-center text-indigo-900 px-10">{level.description}</h2>
            {renderActivity()}
            <div className="mt-6 text-center">
                {level.type === 'phonics' && (
                    <button onClick={startListening} disabled={isListening} className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-6 rounded-lg shadow-md disabled:bg-cyan-300">
                        {isListening ? 'Listening...' : 'Speak the Word! 🎤'}
                    </button>
                )}
                {isComplete && (
                     <button onClick={handleCompleteLevel} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md animate-pulse">
                        Next Level! &rarr;
                    </button>
                )}
            </div>
            <GameScreenAdBanner />
        </div>
    );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [view, setView] = useState<GameView>('welcome');
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number | null>(null);
  const [customLevel, setCustomLevel] = useState<PhonicsLevel | null>(null);
  const { progress, saveProgress } = useGameProgress();
  const [feedback, setFeedback] = useState<FeedbackDisplayProps['feedback']>(null);
  const [showProgressReport, setShowProgressReport] = useState(false);
  const [showInterstitialAd, setShowInterstitialAd] = useState(false);

  useEffect(() => {
    if (feedback) {
        const timer = setTimeout(() => setFeedback(null), 2000);
        return () => clearTimeout(timer);
    }
  }, [feedback]);
  
  const handleStart = () => setView('levelsMenu');
  
  const handleSelectLevel = (index: number) => {
    setCurrentLevelIndex(index);
    setCustomLevel(null);
    setView('game');
  };

  const handleSelectCustomLevel = (level: PhonicsLevel) => {
    setCurrentLevelIndex(null);
    setCustomLevel(level);
    setView('game');
  };

  const handleLevelComplete = () => {
    if (currentLevelIndex !== null) {
        const newProgress = { ...progress };
        if (!newProgress.levels[currentLevelIndex]) {
            newProgress.levels[currentLevelIndex] = true;
            newProgress.stars += 1;
        }
        saveProgress(newProgress);
    }
    // Show interstitial ad instead of navigating directly
    setShowInterstitialAd(true);
  };

  const handleCloseInterstitial = () => {
    setShowInterstitialAd(false);
    setView('levelsMenu');
    setCurrentLevelIndex(null);
    setCustomLevel(null);
  };
  
  const handleCustomizeAvatar = () => {
    const outfits = ['👦', '👧', '🧙‍♂️', '🧙‍♀️', '👸', '🤴', '🧚', '🧞'];
    const currentAvatarIndex = outfits.indexOf(progress.avatar);
    const nextAvatar = outfits[(currentAvatarIndex + 1) % outfits.length];
    saveProgress({ ...progress, avatar: nextAvatar });
  };

  const currentLevelConfig = customLevel || (currentLevelIndex !== null ? LEVEL_CONFIGS[currentLevelIndex] : null);

  return (
    <>
      <StarryBackground />
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 font-sans text-gray-800">
        <header className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-indigo-900 text-glow" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
            🌟 Magic Quest: Phonics Adventure 🌟
          </h1>
        </header>

        <main className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-5 sm:p-8 shadow-2xl border-4 border-white/50">
          {view === 'welcome' && <WelcomeScreen onStart={handleStart} />}
          {view === 'levelsMenu' && <LevelsMenuScreen progress={progress} onSelectLevel={handleSelectLevel} onSelectCustomLevel={handleSelectCustomLevel} />}
          {view === 'game' && currentLevelConfig && (
            <div>
              <FeedbackDisplay feedback={feedback} />
              <GameScreen
                level={currentLevelConfig}
                onComplete={handleLevelComplete}
                onExit={() => setView('levelsMenu')}
                setFeedback={setFeedback}
              />
            </div>
          )}
          
          {view !== 'welcome' && (
            <section id="rewards" className="mt-8 pt-6 border-t-2 border-dashed border-indigo-300">
              <h2 className="text-xl font-bold text-center text-indigo-800 mb-2">Your Progress</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <img src={`https://via.placeholder.com/100/ff69b4/ffffff?text=${encodeURIComponent(progress.avatar)}`} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-yellow-400 shadow-lg"/>
                <div className="text-center sm:text-left">
                  <p className="font-bold text-indigo-700">Stars: {progress.stars} ⭐</p>
                   <button onClick={handleCustomizeAvatar} className="mt-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold py-2 px-4 rounded-full shadow-md transition-transform hover:scale-105">Change Outfit</button>
                   <button onClick={() => setShowProgressReport(true)} className="mt-2 ml-2 bg-sky-500 hover:bg-sky-600 text-white text-sm font-bold py-2 px-4 rounded-full shadow-md transition-transform hover:scale-105">View Report</button>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>

       {showProgressReport && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowProgressReport(false)}>
            <div className="bg-blue-50 rounded-lg p-6 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-indigo-900 mb-4">Parent Progress Report</h2>
                <div className="space-y-2 text-indigo-800">
                    <p><strong>Levels Completed:</strong> {progress.levels.filter(Boolean).length} / {TOTAL_LEVELS}</p>
                    <p><strong>Stars Earned:</strong> {progress.stars} ⭐</p>
                    <p><strong>Current Avatar:</strong> {progress.avatar}</p>
                    <p><strong>Speech Practice:</strong> {progress.stars > 10 ? 'Excellent!' : 'Keep practicing!'}</p>
                </div>
                <p className="mt-4 text-sm text-indigo-600">Tip: Encourage clear speaking for better adaptation!</p>
                <button onClick={() => setShowProgressReport(false)} className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full font-bold text-lg">&times;</button>
            </div>
         </div>
       )}

       {showInterstitialAd && <InterstitialAd onClose={handleCloseInterstitial} />}
    </>
  );
};

export default App;
