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
  if (req.method !== 'POST') return res.status(405).end()

  const { token, title, body, data } = req.body

  if (!token) return res.status(400).json({ error: 'FCM token required' })

  const message = {
    notification: { title, body },
    data: data || {},
    token,
  }

  try {
    const response = await admin.messaging().send(message)
    res.status(200).json({ success: true, messageId: response })
  } catch (error) {
    console.error('Error sending FCM:', error)
    res.status(500).json({ error: error.message })
  }
}
