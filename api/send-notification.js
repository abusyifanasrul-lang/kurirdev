import admin from 'firebase-admin'

// Lazy init — decode base64 service account JSON to avoid Vercel newline issues
function getAdmin() {
  if (!admin.apps.length) {
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64

    if (!base64) {
      throw new Error('Missing env var: FIREBASE_SERVICE_ACCOUNT_BASE64')
    }

    const serviceAccount = JSON.parse(
      Buffer.from(base64, 'base64').toString('utf8')
    )

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
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
      // Data-only message: display is handled by sw.js (background) and App.tsx (foreground)
      // Do NOT add top-level "notification" — Chrome will auto-display it AND onBackgroundMessage fires = double
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
        }
      }
    }

    const response = await fb.messaging().send(message)
    res.status(200).json({ success: true, messageId: response })
  } catch (error) {
    console.error('Error in send-notification:', error)

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
