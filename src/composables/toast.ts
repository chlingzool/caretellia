import { ref, shallowRef } from "vue";

export interface ToastMessage {
  id: number;
  message: string;
}

export const currentToast = shallowRef<ToastMessage | null>(null);
export const toastProgress = ref(100);
let nextToastId = 0;
let dismissTimer: number | null = null;
let progressTimer: number | null = null;
let dismissDeadline = 0;
let remainingDuration = 0;
const toastDuration = 2800;

function clearDismissTimer() {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function clearProgressTimer() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
}

function scheduleDismiss(duration: number) {
  clearDismissTimer();
  clearProgressTimer();
  remainingDuration = duration;
  dismissDeadline = Date.now() + duration;
  toastProgress.value = Math.min(100, (duration / toastDuration) * 100);
  dismissTimer = window.setTimeout(() => dismissToast(), duration);
  progressTimer = window.setInterval(() => {
    toastProgress.value = Math.max(0, ((dismissDeadline - Date.now()) / toastDuration) * 100);
  }, 30);
}

export function dismissToast() {
  clearDismissTimer();
  clearProgressTimer();
  toastProgress.value = 0;
  currentToast.value = null;
}

export function pauseToast() {
  if (dismissTimer === null) return;
  clearDismissTimer();
  remainingDuration = Math.max(0, dismissDeadline - Date.now());
  toastProgress.value = Math.max(0, (remainingDuration / toastDuration) * 100);
  clearProgressTimer();
}

export function resumeToast() {
  if (!currentToast.value || dismissTimer !== null) return;
  scheduleDismiss(remainingDuration);
}

export function showToast(message: string) {
  currentToast.value = { id: ++nextToastId, message };
  scheduleDismiss(toastDuration);
}
