// Reads answers aloud to callers.
export async function speak(text: string, key: string) {
  return fetch('https://api.elevenlabs.io/v1/text-to-speech/voice-id', { method: 'POST', headers: { 'xi-api-key': key }, body: JSON.stringify({ text }) });
}
