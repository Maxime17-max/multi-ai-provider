const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,
  /sk-ant-[a-zA-Z0-9]{20,}/g,
  /AIza[a-zA-Z0-9_-]{35,}/g,
  /[A-Za-z0-9_-]{40,}/g,
];

const REDACTED = '[REDACTED]';

function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, REDACTED);
    }
    return result;
  }
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (/key|token|secret|password|auth/i.test(key)) {
        redacted[key] = REDACTED;
      } else {
        redacted[key] = redact(val);
      }
    }
    return redacted;
  }
  return value;
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

let currentLevel = LogLevel.INFO;

const logFile: string[] = [];

export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

function log(level: LogLevel, levelName: string, ...args: unknown[]): void {
  if (level < currentLevel) return;
  const safe = args.map(redact);
  const line = `[${new Date().toISOString()}] [${levelName}] ${safe.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
  logFile.push(line);
  if (level === LogLevel.ERROR) {
    console.error(line);
  } else if (level === LogLevel.WARN) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (...args: unknown[]) => log(LogLevel.DEBUG, 'DEBUG', ...args),
  info: (...args: unknown[]) => log(LogLevel.INFO, 'INFO', ...args),
  warn: (...args: unknown[]) => log(LogLevel.WARN, 'WARN', ...args),
  error: (...args: unknown[]) => log(LogLevel.ERROR, 'ERROR', ...args),
  getLogs: () => logFile.join('\n'),
  clear: () => { logFile.length = 0; },
};