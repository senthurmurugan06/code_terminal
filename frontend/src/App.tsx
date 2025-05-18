import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import io from 'socket.io-client';
import styled from 'styled-components';
import 'xterm/css/xterm.css';

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1e1e1e;
  color: #fff;
`;

const EditorContainer = styled.div`
  flex: 1;
  min-height: 50vh;
  position: relative;
`;

const TerminalContainer = styled.div`
  height: 40vh;
  background-color: #000;
  padding: 10px;
  position: relative;
`;

const ButtonContainer = styled.div`
  padding: 10px;
  display: flex;
  gap: 10px;
  background-color: #252526;
  border-top: 1px solid #3c3c3c;
`;

const RunButton = styled.button`
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    background-color: #45a049;
  }

  &:disabled {
    background-color: #666;
    cursor: not-allowed;
  }
`;

const ClearButton = styled.button`
  padding: 8px 16px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background-color: #da190b;
  }
`;

const StatusBar = styled.div`
  padding: 4px 10px;
  background-color: #007acc;
  color: white;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 16px;
  z-index: 1000;
`;

function App() {
  const [code, setCode] = useState('# Write your Python code here\nprint("Hello, World!")');
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('Ready');
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const socketRef = useRef<any>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputRequested, setInputRequested] = useState(false);

  useEffect(() => {
    // Initialize terminal
    if (terminalRef.current && !terminal.current) {
      console.log('Initializing terminal...');
      terminal.current = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#ffffff',
          cursor: '#ffffff',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#ffffff'
        }
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      terminal.current.loadAddon(fitAddon);
      terminal.current.loadAddon(webLinksAddon);
      terminal.current.loadAddon(searchAddon);
      terminal.current.open(terminalRef.current);
      fitAddon.fit();
      fitAddonRef.current = fitAddon;

      // Initialize socket connection
      console.log('Connecting to socket server...');
      socketRef.current = io('http://localhost:3000');

      socketRef.current.on('connect', () => {
        console.log('Socket connected');
        terminal.current?.write('\x1b[32mConnected to server\x1b[0m\r\n$ ');
      });

      socketRef.current.on('disconnect', () => {
        console.log('Socket disconnected');
        terminal.current?.write('\x1b[31mDisconnected from server\x1b[0m\r\n$ ');
      });

      socketRef.current.on('output', (data: string) => {
        console.log('Received output:', data);
        terminal.current?.write(data);
      });

      socketRef.current.on('error', (data: string) => {
        console.log('Received error:', data);
        terminal.current?.write('\x1b[31m' + data + '\x1b[0m');
      });

      socketRef.current.on('inputRequest', () => {
        setInputRequested(true);
      });

      socketRef.current.on('hideInputRequest', () => {
        setInputRequested(false);
      });

      socketRef.current.on('executionComplete', () => {
        console.log('Execution completed');
        terminal.current?.write('\r\n$ ');
        setIsRunning(false);
        setStatus('Ready');
        setInputRequested(false);
      });

      // Handle window resize
      const handleResize = () => {
        fitAddonRef.current?.fit();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        socketRef.current?.disconnect();
        terminal.current?.dispose();
      };
    }
  }, []);

  const handleRunCode = () => {
    if (socketRef.current && !isRunning) {
      console.log('Running code:', code);
      setIsRunning(true);
      setStatus('Running...');
      terminal.current?.clear();
      terminal.current?.write('\x1b[32mRunning code...\x1b[0m\r\n');
      socketRef.current.emit('runCode', { code, language: 'python' });
    }
  };

  const handleClearTerminal = () => {
    terminal.current?.clear();
    terminal.current?.write('$ ');
  };

  const handleSendInput = () => {
    if (socketRef.current && inputValue.trim() !== '') {
      socketRef.current.emit('sendInput', inputValue);
      setInputValue('');
      setInputRequested(false);
    }
  };

  return (
    <AppContainer>
      <EditorContainer>
        <Editor
          height="100%"
          defaultLanguage="python"
          theme="vs-dark"
          value={code}
          onChange={(value) => setCode(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            parameterHints: { enabled: true },
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 4,
            insertSpaces: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            autoIndent: 'full',
            matchBrackets: 'always',
            renderWhitespace: 'selection',
            renderControlCharacters: true,
            renderIndentGuides: true,
            renderLineHighlight: 'all',
            renderValidationDecorations: 'on',
            renderFinalNewline: true,
            renderLineNumbers: true,
            renderIndicators: true,
            renderSelectionHighlight: 'on'
          }}
        />
      </EditorContainer>
      <ButtonContainer>
        <RunButton onClick={handleRunCode} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run Code'}
        </RunButton>
        <ClearButton onClick={handleClearTerminal}>Clear Terminal</ClearButton>
      </ButtonContainer>
      <TerminalContainer ref={terminalRef} />
      {inputRequested && (
        <div style={{ display: 'flex', padding: '10px', background: '#222', alignItems: 'center' }}>
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            style={{ flex: 1, marginRight: 8, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#111', color: '#fff' }}
            placeholder="Enter input for your code..."
            onKeyDown={e => { if (e.key === 'Enter') handleSendInput(); }}
            autoFocus
          />
          <button
            onClick={handleSendInput}
            style={{ padding: '6px 16px', background: '#007acc', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Send Input
          </button>
        </div>
      )}
      <StatusBar>
        <span>{status}</span>
        <span>Python 3.9</span>
      </StatusBar>
      {isRunning && (
        <LoadingOverlay>
          Running code...
        </LoadingOverlay>
      )}
    </AppContainer>
  );
}

export default App;
