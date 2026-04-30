// supabase/functions/process-alpha/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Reset late_fine_active semua kurir (harus jalan tiap tengah malam)
    const { error: resetError } = await supabaseClient.rpc('reset_daily_fine_flags')
    if (resetError) throw new Error(`reset_daily_fine_flags failed: ${resetError.message}`)

    // 2. Proses alpha (kurir tidak hadir)
    const { data: alphaData, error: alphaError } = await supabaseClient.rpc('process_shift_alpha')
    if (alphaError) throw new Error(`process_shift_alpha failed: ${alphaError.message}`)

    return new Response(
      JSON.stringify({
        message: 'Nightly processing completed',
        reset_fine_flags: 'ok',
        alpha_result: alphaData,
      }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
