import { enqueueSnackbar, type OptionsObject, type VariantType } from 'notistack'

const defaults: OptionsObject = {
  autoHideDuration: 4000,
  anchorOrigin: { vertical: 'bottom', horizontal: 'center' },
}

export function notify(
  message: string,
  variant: VariantType = 'default',
  options?: OptionsObject,
) {
  enqueueSnackbar(message, { ...defaults, variant, ...options })
}

export function notifySuccess(message: string, options?: OptionsObject) {
  notify(message, 'success', options)
}

export function notifyError(message: string, options?: OptionsObject) {
  notify(message, 'error', { autoHideDuration: 6000, ...options })
}

export function notifyInfo(message: string, options?: OptionsObject) {
  notify(message, 'info', options)
}

export function notifyWarning(message: string, options?: OptionsObject) {
  notify(message, 'warning', options)
}
