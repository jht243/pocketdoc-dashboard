/**
 * A question another screen asks the chat on the member's behalf, e.g. Home's
 * "Help me reduce my biological age" button. The screen queues it and navigates to
 * the chat, which sends it once the member's thread has loaded, so the question
 * lands after their history rather than before it.
 */
let queued = null;

export function queueChatQuestion(text) {
  queued = text;
}

/** The queued question, once. Null when there isn't one. */
export function takeQueuedChatQuestion() {
  const text = queued;
  queued = null;
  return text;
}
