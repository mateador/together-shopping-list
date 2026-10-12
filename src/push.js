// Push notifications via OneSignal. The API sends the pushes (see the API's
// push.py); this file registers the device and tags it so the API can target
// "everyone in my household except the person who added the item".
//
// Inert until VITE_ONESIGNAL_APP_ID is set (see .env.example).

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID

export const pushConfigured = Boolean(APP_ID)

// Resolves to the OneSignal object, or null if the SDK could not load
// (offline, ad blocker). Never rejects.
let ready = null

export function initPush() {
  if (!pushConfigured || ready) return

  let settle
  ready = new Promise((resolve) => { settle = resolve })

  window.OneSignalDeferred = window.OneSignalDeferred || []
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      // OneSignal gets its own scope so it doesn't fight with the PWA's
      // service worker at "/".
      await OneSignal.init({
        appId: APP_ID,
        serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
        serviceWorkerParam: { scope: '/push/onesignal/' }
      })
      settle(OneSignal)
    } catch (err) {
      console.warn('[push] OneSignal init failed', err)
      settle(null)
    }
  })

  const script = document.createElement('script')
  script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
  script.defer = true
  script.onerror = () => {
    console.warn('[push] could not load the OneSignal SDK')
    settle(null)
  }
  document.head.appendChild(script)
}

// Tags must match what the API filters on: `household` is the household code,
// `user` is the display name the app also sends as added_by.
export async function syncPushTags(code, name) {
  if (!ready) return
  const OneSignal = await ready
  if (!OneSignal) return
  OneSignal.User.addTag('household', code)
  if (name) OneSignal.User.addTag('user', name)
  else OneSignal.User.removeTag('user')
}

// Browsers only show the permission prompt in response to a tap, so this is
// called from a button rather than at startup.
export function canAskForPush() {
  return pushConfigured && 'Notification' in window && Notification.permission === 'default'
}

export async function enablePush() {
  if (!ready) return
  const OneSignal = await ready
  if (!OneSignal) return
  await OneSignal.Notifications.requestPermission()
}
