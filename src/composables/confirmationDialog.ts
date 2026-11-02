import { shallowRef } from "vue";

export interface ConfirmationRequest {
  title: string;
  message: string;
  kind: "info" | "warning";
  okLabel?: string;
  cancelLabel?: string;
  confirmDelayMs?: number;
}

export const confirmationRequest = shallowRef<ConfirmationRequest | null>(null);
let settleRequest: ((confirmed: boolean) => void) | null = null;

export function requestConfirmation(request: ConfirmationRequest): Promise<boolean> {
  if (settleRequest) {
    return Promise.reject(new Error("A confirmation dialog is already open."));
  }

  confirmationRequest.value = request;
  return new Promise((resolve) => {
    settleRequest = resolve;
  });
}

export function resolveConfirmation(confirmed: boolean) {
  const settle = settleRequest;
  settleRequest = null;
  confirmationRequest.value = null;
  settle?.(confirmed);
}
