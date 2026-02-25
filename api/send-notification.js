import admin from 'firebase-admin'

// Lazy init — only call initializeApp inside handler to get proper error responses
function getAdmin() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        `Missing Firebase env vars: ${[
          !projectId && 'FIREBASE_PROJECT_ID',
          !clientEmail && 'FIREBASE_CLIENT_EMAIL',
          !privateKey && 'FIREBASE_PRIVATE_KEY',
        ].filter(Boolean).join(', ')}`
      )
    }

    // Parse private key — handle various Vercel env var formats
    let parsedKey = privateKey
    // Strip surrounding quotes if present (Vercel sometimes wraps in quotes)
    if (parsedKey.startsWith('"') && parsedKey.endsWith('"')) {
      parsedKey = JSON.parse(parsedKey)
    }
    // Replace literal \n with actual newlines
    parsedKey = parsedKey.replace(/\\n/g, '\n')

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: parsedKey,
      }),
    })
  }
  return admin
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const fb = getAdmin()

    const { token, title, body, data } = req.body

    if (!token) return res.status(400).json({ error: 'FCM token required' })
    if (!title) return res.status(400).json({ error: 'Title required' })

    const message = {
      token,
      notification: {
        title,
        body: body || '',
      },
      data: {
        title,
        body: body || '',
        orderId: data?.orderId || '',
        type: data?.type || 'general',
        click_action: data?.orderId
          ? `https://kurirdev.vercel.app/courier/orders/${data.orderId}`
          : 'https://kurirdev.vercel.app/courier/orders'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'high_importance_channel',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcm_options: {
          link: data?.orderId
            ? `https://kurirdev.vercel.app/courier/orders/${data.orderId}`
            : 'https://kurirdev.vercel.app/courier/orders'
        },
        notification: {
          title,
          body: body || '',
          icon: 'https://kurirdev.vercel.app/icons/android/android-launchericon-192-192.png',
          badge: 'https://kurirdev.vercel.app/icons/android/android-launchericon-96-96.png',
          tag: data?.orderId || 'kurirdev-notif',
          renotify: true,
          vibrate: [200, 100, 200],
          requireInteraction: true
        }
      }
    }

    const response = await fb.messaging().send(message)
    res.status(200).json({ success: true, messageId: response })
  } catch (error) {
    console.error('Error in send-notification:', error)

    // Handle invalid/expired token
    if (error.code === 'messaging/registration-token-not-registered'
      || error.code === 'messaging/invalid-registration-token') {
      return res.status(410).json({
        error: 'TOKEN_INVALID',
        message: 'FCM token tidak valid, perlu re-register',
        code: error.code
      })
    }

    res.status(500).json({
      error: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN',
    })
  }
}
