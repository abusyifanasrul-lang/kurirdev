import admin from 'firebase-admin'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token, title, body, data } = req.body

  if (!token) return res.status(400).json({ error: 'FCM token required' })
  if (!title) return res.status(400).json({ error: 'Title required' })

  const message = {
    notification: { title, body: body || '' },
    data: data || {},
    token,
    webpush: {
      fcm_options: {
        link: data?.orderId
          ? `https://kurirdev.vercel.app/courier/orders/${data.orderId}`
          : 'https://kurirdev.vercel.app/courier/orders'
      },
      notification: {
        icon: '/icons/android/android-launchericon-192-192.png',
        badge: '/icons/android/android-launchericon-96-96.png',
        vibrate: [200, 100, 200],
      }
    }
  }

  try {
    const response = await admin.messaging().send(message)
    res.status(200).json({ success: true, messageId: response })
  } catch (error) {
    console.error('Error sending FCM:', error)

    // Handle invalid/expired token
    if (error.code === 'messaging/registration-token-not-registered'
      || error.code === 'messaging/invalid-registration-token') {
      return res.status(410).json({
        error: 'TOKEN_INVALID',
        message: 'FCM token tidak valid, perlu re-register',
        code: error.code
      })
    }

    res.status(500).json({ error: error.message, code: error.code })
  }
}

