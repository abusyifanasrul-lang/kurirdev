interface SendPushParams {
    token: string
    title: string
    body: string
    data?: Record<string, string>
}

export const sendPushNotification = async (params: SendPushParams): Promise<boolean> => {
    try {
        const response = await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })

        if (!response.ok) {
            const error = await response.json()
            console.error('❌ Push notification failed:', error)
            return false
        }

        const result = await response.json()
        console.log('✅ Push notification sent:', result.messageId)
        return true
    } catch (error) {
        console.error('❌ Push notification error:', error)
        return false
    }
}
