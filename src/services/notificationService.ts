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
            headers: { 
                'Content-Type': 'application/json',
                'x-api-secret': import.meta.env.VITE_API_SECRET,
            },
            body: JSON.stringify(params),
        })

        const text = await response.text()
        let result: any
        try {
            result = JSON.parse(text)
        } catch {
            result = { error: text }
        }

        if (!response.ok) {
            console.error('❌ Push notification failed:', response.status, result)
            return false
        }

        console.log('✅ Push notification sent:', result.messageId)
        return true
    } catch (error) {
        console.error('❌ Push notification error:', error)
        return false
    }
}
