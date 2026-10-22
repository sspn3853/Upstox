const { spawn } = require('child_process');
const net = require('net');

const defaultCommand = 'node server.js';
const command = process.env.RESTART_CHILD_COMMAND || defaultCommand;
const restartDelayMs = Number(process.env.RESTART_DELAY_MS || 2000);
const maxRestarts = Number(process.env.MAX_RESTARTS || 10);
const port = Number(process.env.PORT || 3000);

let child = null;
let restartCount = 0;
let shuttingDown = false;

function isPortBusy(portNumber) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', (err) => resolve(err && err.code === 'EADDRINUSE'));
    tester.once('listening', () => {
      tester.once('close', () => resolve(false));
      tester.close();
    });
    tester.listen(portNumber, '0.0.0.0');
  });
}

async function isPortAvailable(portNumber) {
  return !(await isPortBusy(portNumber));
}

function parseCommand(commandLine) {
  const trimmed = commandLine.trim();
  if (!trimmed) return { command: 'node', args: ['server.js'] };

  const match = trimmed.match(/^"([^"]+)"\s+(.+)$|^'([^']+)'\s+(.+)$|^([^\s]+)(?:\s+(.+))?$/);
  if (!match) {
    return { command: 'node', args: ['server.js'] };
  }

  const fullCommand = match[1] || match[3] || match[5];
  const remainder = match[2] || match[4] || match[6] || '';
  const args = remainder ? remainder.match(/"[^"]+"|'[^']+'|\S+/g) || [] : [];
  return { command: fullCommand, args: args.map((value) => value.replace(/^['"]|['"]$/g, '')) };
}

async function startChild() {
  const { command: execPath, args } = parseCommand(command);

  const portAvailable = await isPortAvailable(port);
  if (!portAvailable) {
    console.error(`❌ port ${port} is already in use; monitor will not terminate another process.`);
    process.exit(1);
    return;
  }

  child = spawn(execPath, args, {
    stdio: 'inherit',
    env: process.env,
    cwd: __dirname
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const exitMessage = `⚠️ child exited (code=${code}, signal=${signal})`;
    restartCount += 1;
    console.log(`${exitMessage}. restarting in ${restartDelayMs}ms...`);

    if (restartCount <= maxRestarts) {
      setTimeout(() => startChild(), restartDelayMs);
      return;
    }

    console.error(`❌ maximum restarts reached (${maxRestarts}). stopping monitor.`);
    process.exit(1);
  });

  child.on('error', (err) => {
    console.error('❌ child process error:', err.message);
    if (!shuttingDown) {
      process.exit(1);
    }
  });
}

function stop() {
  shuttingDown = true;
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(`🟢 server monitor started for: ${command}`);
startChild();
