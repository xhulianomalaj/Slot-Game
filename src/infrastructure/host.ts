// Platform host glue — bridges the client to the lobby/RGS shell.
// Replace the postMessage payload shape per platform contract.

export function requestExit(): void {
  if (typeof window === 'undefined') return;
  try {
    window.parent?.postMessage({ type: 'slotplate:exit' }, '*');
  } catch {
    // No parent or cross-origin block — fall through to history.
  }
  if (window.history.length > 1) {
    window.history.back();
  }
}
