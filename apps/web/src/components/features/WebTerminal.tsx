import { useState, useRef, useEffect, useCallback } from 'react';
import type { OutputLine } from '../../lib/sdk/types';

export type StreamCallback = (line: OutputLine) => void;

interface WebTerminalProps {
  onCommand: (input: string, stream?: StreamCallback) => Promise<OutputLine[]>;
  prompt?: string;
  initialOutput?: OutputLine[];
}

export function WebTerminal({ onCommand, prompt = '>', initialOutput = [] }: WebTerminalProps) {
  const [history, setHistory] = useState<OutputLine[]>(initialOutput);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const cmd = input.trim();
    
    setHistory(prev => [...prev, { type: 'plain', text: `${prompt} ${cmd}` }]);
    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
    setInput('');
    setIsProcessing(true);

    const streamLine: StreamCallback = (line) => {
      setHistory(prev => [...prev, line]);
    };

    try {
      const output = await onCommand(cmd, streamLine);
      if (output.length > 0) {
        setHistory(prev => [...prev, ...output]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { 
        type: 'error', 
        text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` 
      }]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, isProcessing, onCommand, prompt]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 
          ? commandHistory.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      }
    }
  }, [commandHistory, historyIndex]);

  const getLineClass = (type: OutputLine['type']) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'warn': return 'text-amber-400';
      case 'info': return 'text-cyan-400';
      case 'dim': return 'text-slate-500';
      case 'bold': return 'text-white font-bold';
      case 'plain':
      default: return 'text-slate-300';
    }
  };

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-output]')) {
      inputRef.current?.focus();
    }
  }, []);

  return (
    <div 
      className="bg-slate-950 border border-slate-800 rounded-lg font-mono text-sm h-full flex flex-col overflow-hidden"
      onClick={handleContainerClick}
    >
      <div 
        ref={outputRef}
        data-output
        className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent select-text cursor-text"
      >
        {history.map((line, i) => (
          <div key={i} className={`${getLineClass(line.type)} whitespace-pre-wrap break-all`}>
            {line.text}
          </div>
        ))}
        {isProcessing && (
          <div className="text-slate-500 animate-pulse">Processing...</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-800 p-3 flex items-center gap-2">
        <span className="text-cyan-400 font-bold">{prompt}</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isProcessing}
          className="flex-1 bg-transparent text-slate-100 outline-none placeholder-slate-600 caret-cyan-400"
          placeholder={isProcessing ? 'Processing...' : 'Type a command...'}
          autoComplete="off"
          spellCheck={false}
        />
      </form>
    </div>
  );
}
