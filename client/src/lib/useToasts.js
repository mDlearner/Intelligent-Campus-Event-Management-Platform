import { useCallback, useState } from "react";

export function useToasts(autoDismissMs = 5000) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = "info", message, actionLabel, action }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((previous) => [...previous, { id, type, message, actionLabel, action }]);

      window.setTimeout(() => {
        dismissToast(id);
      }, autoDismissMs);
    },
    [autoDismissMs, dismissToast]
  );

  return {
    toasts,
    showToast,
    dismissToast
  };
}