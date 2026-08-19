// Re-exported from the shared `ui` library so existing relative imports
// (`shared/utils/toast.service`) keep working. See projects/ui/src/lib/toast
// for the implementation — a signal-backed replacement for MatSnackBar.
export { ToastService } from 'ui';
