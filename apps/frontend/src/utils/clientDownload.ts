export type ClientPlatform = 'mac-arm64' | 'mac-x64' | 'win';

export const CLIENT_FILES: Record<ClientPlatform, string> = {
  'mac-arm64': '/downloads/mammoth-agent-mac-arm64.dmg',
  'mac-x64': '/downloads/mammoth-agent-mac-x64.dmg',
  win: '/downloads/mammoth-agent-win.exe',
};

export const CLIENT_PLATFORM_OPTIONS: Array<{ id: ClientPlatform; label: string }> = [
  { id: 'mac-arm64', label: 'macOS（Apple 芯片）' },
  { id: 'mac-x64', label: 'macOS（Intel 芯片）' },
  { id: 'win', label: 'Windows' },
];

export function detectClientPlatform(): ClientPlatform {
  if (typeof navigator === 'undefined') return 'win';
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isMac = /Mac|iPhone|iPad/i.test(ua) || /Mac/i.test(platform);
  if (isMac) return 'mac-arm64';
  return 'win';
}

export function clientDownloadUrl(platform?: ClientPlatform) {
  return CLIENT_FILES[platform ?? detectClientPlatform()];
}

export function clientDownloadPrimaryLabel(platform?: ClientPlatform) {
  const resolved = platform ?? detectClientPlatform();
  return resolved === 'win' ? '下载 Windows 客户端' : '下载 macOS 客户端';
}
