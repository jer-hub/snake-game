import { useState, useEffect, useCallback, useRef } from 'react';

// Types
type Position = { x: number; y: number };
type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';
type Difficulty = 'easy' | 'medium' | 'hard';

// Constants
const GRID_SIZE = 20;
const SPEEDS: Record<Difficulty, number> = {
  easy: 160,
  medium: 100,
  hard: 60,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

// Helper functions
function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
  return pos;
}

function getInitialSnake(): Position[] {
  const mid = Math.floor(GRID_SIZE / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

// Main App Component
export default function App() {
  const [snake, setSnake] = useState<Position[]>(getInitialSnake());
  const [food, setFood] = useState<Position>(() => getRandomPosition(getInitialSnake()));
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-high-score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showScoreAnimation, setShowScoreAnimation] = useState(false);

  const directionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastDirectionRef = useRef<Direction>('RIGHT');

  // Keep directionRef in sync
  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  // Game loop
  const moveSnake = useCallback(() => {
    setSnake(prevSnake => {
      const head = { ...prevSnake[0] };
      const currentDir = directionRef.current;

      switch (currentDir) {
        case 'UP': head.y -= 1; break;
        case 'DOWN': head.y += 1; break;
        case 'LEFT': head.x -= 1; break;
        case 'RIGHT': head.x += 1; break;
      }

      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState('gameover');
        return prevSnake;
      }

      // Self collision
      if (prevSnake.some(seg => seg.x === head.x && seg.y === head.y)) {
        setGameState('gameover');
        return prevSnake;
      }

      const newSnake = [head, ...prevSnake];

      // Check food
      setFood(prevFood => {
        if (head.x === prevFood.x && head.y === prevFood.y) {
          setScore(prev => {
            const newScore = prev + 10;
            setHighScore(currentHigh => {
              if (newScore > currentHigh) {
                localStorage.setItem('snake-high-score', String(newScore));
                return newScore;
              }
              return currentHigh;
            });
            setShowScoreAnimation(true);
            setTimeout(() => setShowScoreAnimation(false), 300);
            return newScore;
          });
          const newFood = getRandomPosition(newSnake);
          return newFood;
        }
        newSnake.pop();
        return prevFood;
      });

      lastDirectionRef.current = currentDir;
      return newSnake;
    });
  }, []);

  // Start/stop game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = window.setInterval(moveSnake, SPEEDS[difficulty]);
    } else {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState, moveSnake, difficulty]);

  const startGame = useCallback(() => {
    const initialSnake = getInitialSnake();
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    directionRef.current = 'RIGHT';
    lastDirectionRef.current = 'RIGHT';
    setScore(0);
    setGameState('playing');
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      if (key === ' ' || key === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        } else if (gameState === 'idle' || gameState === 'gameover') {
          startGame();
        }
        return;
      }

      if (gameState !== 'playing') return;

      const lastDir = lastDirectionRef.current;
      let newDir: Direction | null = null;

      switch (key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (lastDir !== 'DOWN') newDir = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (lastDir !== 'UP') newDir = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (lastDir !== 'RIGHT') newDir = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (lastDir !== 'LEFT') newDir = 'RIGHT';
          break;
      }

      if (newDir) {
        setDirection(newDir);
        directionRef.current = newDir;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, startGame]);

  // Touch controls
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      const lastDir = lastDirectionRef.current;
      let newDir: Direction | null = null;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && lastDir !== 'LEFT') newDir = 'RIGHT';
        else if (dx < 0 && lastDir !== 'RIGHT') newDir = 'LEFT';
      } else {
        if (dy > 0 && lastDir !== 'UP') newDir = 'DOWN';
        else if (dy < 0 && lastDir !== 'DOWN') newDir = 'UP';
      }

      if (newDir && gameState === 'playing') {
        setDirection(newDir);
        directionRef.current = newDir;
      }

      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState]);

  const togglePause = () => {
    if (gameState === 'playing') setGameState('paused');
    else if (gameState === 'paused') setGameState('playing');
  };

  const handleDirectionButton = (dir: Direction) => {
    if (gameState !== 'playing') return;
    const lastDir = lastDirectionRef.current;
    if (
      (dir === 'UP' && lastDir !== 'DOWN') ||
      (dir === 'DOWN' && lastDir !== 'UP') ||
      (dir === 'LEFT' && lastDir !== 'RIGHT') ||
      (dir === 'RIGHT' && lastDir !== 'LEFT')
    ) {
      setDirection(dir);
      directionRef.current = dir;
    }
  };

  // Render game board cells
  const renderBoard = () => {
    const cells = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const isHead = snake[0].x === x && snake[0].y === y;
        const isBody = !isHead && snake.some(seg => seg.x === x && seg.y === y);
        const isFood = food.x === x && food.y === y;
        const isEvenCell = (x + y) % 2 === 0;

        let cellClass = 'snake-cell ';
        if (isHead) cellClass += 'snake-head';
        else if (isBody) cellClass += 'snake-body';
        else if (isFood) cellClass += 'snake-food';
        else cellClass += isEvenCell ? 'cell-light' : 'cell-dark';

        cells.push(
          <div key={`${x}-${y}`} className={cellClass} />
        );
      }
    }
    return cells;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 select-none">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-emerald-400 tracking-wider mb-2 drop-shadow-lg">
          🐍 SNAKE
        </h1>

        {/* Score Bar */}
        <div className="flex justify-between items-center bg-gray-800/80 rounded-xl px-4 py-2 backdrop-blur-sm border border-gray-700">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Score</span>
            <span className={`text-xl font-bold text-white transition-transform ${showScoreAnimation ? 'scale-125' : 'scale-100'}`}>
              {score}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Best</span>
            <span className="text-xl font-bold text-amber-400">
              {highScore}
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Speed</span>
            <span className="text-xl font-bold text-cyan-400">
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-lg aspect-square">
        <div className="snake-board rounded-xl overflow-hidden shadow-2xl border-2 border-gray-600">
          {renderBoard()}
        </div>

        {/* Overlay for idle/paused/gameover */}
        {gameState !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl backdrop-blur-sm animate-fade-in">
            {gameState === 'idle' && (
              <>
                <div className="text-5xl mb-4 animate-bounce">🐍</div>
                <p className="text-white text-lg mb-2">Ready to play?</p>
                <p className="text-gray-400 text-sm mb-4">Use arrow keys, WASD, or swipe to control</p>
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  Start Game
                </button>
              </>
            )}
            {gameState === 'paused' && (
              <>
                <div className="text-4xl mb-4">⏸️</div>
                <p className="text-white text-xl mb-4">Paused</p>
                <button
                  onClick={togglePause}
                  className="px-8 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  Resume
                </button>
              </>
            )}
            {gameState === 'gameover' && (
              <>
                <div className="text-4xl mb-2">💀</div>
                <p className="text-white text-xl mb-1">Game Over!</p>
                <p className="text-gray-300 mb-1">Score: <span className="text-emerald-400 font-bold">{score}</span></p>
                {score >= highScore && score > 0 && (
                  <p className="text-amber-400 text-sm mb-2 animate-pulse">🏆 New High Score!</p>
                )}
                <button
                  onClick={startGame}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg mt-2"
                >
                  Play Again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 space-y-3">
        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {gameState === 'playing' && (
            <button
              onClick={togglePause}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm font-medium border border-gray-600"
            >
              ⏸ Pause
            </button>
          )}
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={startGame}
              className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all text-sm font-medium border border-gray-600"
            >
              🔄 Restart
            </button>
          )}
        </div>

        {/* Difficulty Selector */}
        <div className="flex justify-center gap-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => {
                setDifficulty(d);
                if (gameState === 'idle') return;
                if (gameState === 'gameover') return;
              }}
              disabled={gameState === 'playing' || gameState === 'paused'}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                difficulty === d
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                  : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
              } ${(gameState === 'playing' || gameState === 'paused') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {/* Mobile D-Pad */}
        <div className="flex justify-center md:hidden mt-2">
          <div className="grid grid-cols-3 gap-1 w-36">
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('UP'); }}
              onClick={() => handleDirectionButton('UP')}
              className="aspect-square bg-gray-700 hover:bg-gray-600 active:bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xl border border-gray-600 transition-all"
            >
              ▲
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('LEFT'); }}
              onClick={() => handleDirectionButton('LEFT')}
              className="aspect-square bg-gray-700 hover:bg-gray-600 active:bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xl border border-gray-600 transition-all"
            >
              ◀
            </button>
            <div className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center border border-gray-700">
              <div className="w-3 h-3 bg-gray-600 rounded-full" />
            </div>
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('RIGHT'); }}
              onClick={() => handleDirectionButton('RIGHT')}
              className="aspect-square bg-gray-700 hover:bg-gray-600 active:bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xl border border-gray-600 transition-all"
            >
              ▶
            </button>
            <div />
            <button
              onTouchStart={(e) => { e.preventDefault(); handleDirectionButton('DOWN'); }}
              onClick={() => handleDirectionButton('DOWN')}
              className="aspect-square bg-gray-700 hover:bg-gray-600 active:bg-emerald-600 rounded-lg flex items-center justify-center text-white text-xl border border-gray-600 transition-all"
            >
              ▼
            </button>
            <div />
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center text-gray-500 text-xs mt-2 space-y-0.5">
          <p className="hidden md:block">Arrow Keys / WASD to move • Space to pause • Esc to restart</p>
          <p className="md:hidden">Swipe to move • Tap buttons to control</p>
        </div>
      </div>
    </div>
  );
}
