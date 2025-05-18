import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Store active containers
const activeContainers = new Map<string, any>();

// Helper function to sanitize code
function sanitizeCode(code: string): string {
  // Remove any potential command injection attempts
  return code.replace(/[;&|`$]/g, '');
}

// Helper function to format output
function formatOutput(data: string): string {
  // Add ANSI color codes for better readability
  return data
    .replace(/Error:/g, '\x1b[31mError:\x1b[0m')
    .replace(/Warning:/g, '\x1b[33mWarning:\x1b[0m')
    .replace(/Success:/g, '\x1b[32mSuccess:\x1b[0m')
    .replace(/Info:/g, '\x1b[36mInfo:\x1b[0m');
}

io.on('connection', (socket) => {
  console.log('Client connected');

  let currentContainer: any = null;

  socket.on('runCode', async (data: { code: string, language: string }) => {
    console.log('Received code execution request');
    const containerId = uuidv4();
    try {
      // Sanitize the code
      const sanitizedCode = sanitizeCode(data.code);
      console.log('Sanitized code:', sanitizedCode);

      // Create and run Docker container
      console.log('Starting Docker container...');
      const container = spawn('docker', [
        'run',
        '--rm',
        '-i',
        '--name', containerId,
        '--network', 'none',
        '--memory', '512m',
        '--cpus', '1',
        'code-editor-env',
        'python',
        '-c',
        sanitizedCode
      ], { stdio: ['pipe', 'pipe', 'pipe'] });

      currentContainer = container;
      activeContainers.set(containerId, container);

      // Always show input box when code is running
      socket.emit('inputRequest');

      // Handle container output
      container.stdout.on('data', (data) => {
        console.log('Received stdout:', data.toString());
        const formattedOutput = formatOutput(data.toString());
        socket.emit('output', formattedOutput);
      });

      container.stderr.on('data', (data) => {
        console.log('Received stderr:', data.toString());
        const formattedError = formatOutput(data.toString());
        socket.emit('error', formattedError);
      });

      container.on('close', (code) => {
        console.log('Container closed with code:', code);
        if (code === 0) {
          socket.emit('output', '\x1b[32mExecution completed successfully.\x1b[0m\r\n');
        } else {
          socket.emit('error', `\x1b[31mExecution failed with code ${code}.\x1b[0m\r\n`);
        }
        socket.emit('executionComplete', { code });
        activeContainers.delete(containerId);
        currentContainer = null;
        // Hide input box when code execution ends
        socket.emit('hideInputRequest');
      });

      // Set a timeout for long-running processes
      const timeout = setTimeout(() => {
        if (activeContainers.has(containerId)) {
          console.log('Execution timed out');
          container.kill();
          socket.emit('error', '\x1b[31mExecution timed out after 10 seconds.\x1b[0m\r\n');
          activeContainers.delete(containerId);
          currentContainer = null;
          socket.emit('hideInputRequest');
        }
      }, 10000);

      container.on('close', () => {
        clearTimeout(timeout);
      });

    } catch (error: any) {
      console.error('Error executing code:', error);
      socket.emit('error', '\x1b[31mFailed to execute code: ' + error.message + '\x1b[0m\r\n');
      socket.emit('hideInputRequest');
    }
  });

  // Listen for input from frontend
  socket.on('sendInput', (input: string) => {
    if (currentContainer && currentContainer.stdin.writable) {
      currentContainer.stdin.write(input + '\n');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Clean up any active containers
    activeContainers.forEach((container, id) => {
      container.kill();
      activeContainers.delete(id);
    });
    currentContainer = null;
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 