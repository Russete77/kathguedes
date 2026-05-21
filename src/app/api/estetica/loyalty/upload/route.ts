import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/estetica/loyalty/upload
 * Upload de foto da moto pós-serviço para o programa fidelidade.
 *
 * - Aceita apenas imagem (≤ 5MB)
 * - Exige booking_id do próprio user com status='done'
 * - 1 foto por booking (unique constraint)
 * - Lazy cleanup: apaga fotos de meses anteriores ao atual do próprio user
 * - Storage: bucket estetica-loyalty, path {userId}/{bookingId}-{timestamp}.{ext}
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("photo") as File | null;
  const bookingId = form.get("booking_id") as string | null;

  if (!file || !bookingId) {
    return NextResponse.json(
      { error: "Arquivo ou booking_id faltando" },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Apenas imagens são aceitas" },
      { status: 400 },
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Arquivo maior que 5MB" },
      { status: 400 },
    );
  }

  const supabase = createAdminSupabaseClient();

  // 1. Verificar booking pertence ao user e está concluído
  const { data: bookingRaw } = await supabase
    .from("estetica_bookings")
    .select("id, status, service_id")
    .eq("id", bookingId)
    .eq("user_id", userId)
    .single();

  if (!bookingRaw) {
    return NextResponse.json(
      { error: "Agendamento não encontrado" },
      { status: 404 },
    );
  }

  const booking = bookingRaw as unknown as {
    id: string;
    status: string;
    service_id: string;
  };

  if (booking.status !== "done") {
    return NextResponse.json(
      { error: "Serviço ainda não foi concluído" },
      { status: 400 },
    );
  }

  // 2. Verificar serviço é elegível pra fidelidade
  const { data: serviceRaw } = await supabase
    .from("estetica_services")
    .select("eligible_for_loyalty")
    .eq("id", booking.service_id)
    .single();

  const service = serviceRaw as unknown as {
    eligible_for_loyalty: boolean;
  } | null;

  if (!service?.eligible_for_loyalty) {
    return NextResponse.json(
      { error: "Este serviço não conta no programa fidelidade" },
      { status: 400 },
    );
  }

  // 3. Lazy cleanup — apagar fotos de meses anteriores do user (e bucket)
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: oldPhotosRaw } = await supabase
    .from("estetica_loyalty_photos")
    .select("id, photo_url")
    .eq("user_id", userId)
    .lt("month", currentMonth);

  const oldPhotos = (oldPhotosRaw || []) as unknown as {
    id: string;
    photo_url: string;
  }[];

  if (oldPhotos.length > 0) {
    // Extrair paths (tudo depois de .../object/{public|sign}/estetica-loyalty/)
    const paths = oldPhotos
      .map((p) => {
        const m = p.photo_url.match(/estetica-loyalty\/(.+?)(\?|$)/);
        return m?.[1];
      })
      .filter((x): x is string => !!x);

    if (paths.length > 0) {
      await supabase.storage.from("estetica-loyalty").remove(paths);
    }

    await supabase.rpc("lazy_cleanup_loyalty_photos", { p_user_id: userId });
  }

  // 4. Upload pro bucket
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${bookingId}-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("estetica-loyalty")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // 5. Gerar signed URL (bucket é privado)
  const { data: signed } = await supabase.storage
    .from("estetica-loyalty")
    .createSignedUrl(path, 60 * 60 * 24 * 45); // 45 dias

  const photoUrl = signed?.signedUrl || path;

  // 6. Inserir registro
  const { error: insertErr } = await supabase
    .from("estetica_loyalty_photos")
    .insert({
      user_id: userId,
      booking_id: bookingId,
      photo_url: photoUrl,
      month: currentMonth,
      approved: false,
    });

  if (insertErr) {
    await supabase.storage.from("estetica-loyalty").remove([path]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, photo_url: photoUrl });
}
