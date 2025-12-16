export interface ZmxSession {
  name: string;
  pid?: number;
  clients?: number;
}

export interface TerminalWindow {
  id: number;
  name: string;
  sessionName: string;
}

export interface ScreenshotResult {
  data: string; // base64 encoded
  mimeType: string;
}

export interface SessionStatus {
  sessionName: string | null;
  isActive: boolean;
  windowId: number | null;
  sessions: ZmxSession[];
}
