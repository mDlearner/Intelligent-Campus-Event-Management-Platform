export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts?.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-3 top-24 z-[90] flex w-auto max-w-sm flex-col gap-3 sm:left-auto sm:right-4 sm:top-24 sm:w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur ${
            toast.type === "success"
              ? "border-[var(--teal)]/40 bg-[rgba(0,212,170,0.14)]"
              : toast.type === "error"
              ? "border-[var(--rose)]/40 bg-[rgba(255,107,138,0.14)]"
              : "border-[var(--border2)] bg-[var(--surface2)]/80"
          }`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">{toast.message}</p>
            <button
              className="rounded-full px-2 py-1 text-xs text-[var(--text3)] hover:bg-[var(--surface2)]"
              type="button"
              onClick={() => onDismiss(toast.id)}
            >
              Close
            </button>
          </div>
          {toast.action && toast.actionLabel && (
            <div className="mt-3 flex justify-end">
              <button
                className="rounded-full border border-[var(--border2)] bg-[var(--surface2)]/70 px-3 py-1 text-xs font-semibold text-[var(--text2)] transition hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                type="button"
                onClick={() => {
                  toast.action();
                  onDismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}