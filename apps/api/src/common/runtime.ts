export function demoMode(): boolean { return process.env.MOCK_LLM !== '0'; }
export function assertLiveAllowed(): void {
  if (demoMode() || process.env.ALLOW_LIVE_PROVIDERS !== '1') throw new Error('live_provider_disabled');
}
