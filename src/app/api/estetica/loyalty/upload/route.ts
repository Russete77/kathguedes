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
  const bookingIdFromForm = form.get("booking_id") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Arquivo faltando" }, { status: 400 });
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

  // 1. Resolver booking — quando o cliente envia booking_id (fluxo do per-booking
  //    upload de /meus-agendamentos), valida estritamente. Quando NAO envia
  //    (fluxo do /fidelidade), pega o primeiro booking `done` + elegivel +
  //    SEM foto ainda do user. Sem booking elegivel → 422 acionavel.
  let booking: { id: string; status: string; service_id: string } | null = null;

  if (bookingIdFromForm) {
    const { data: bookingRaw } = await supabase
      .from("estetica_bookings")
      .select("id, status, service_id")
      .eq("id", bookingIdFromForm)
      .eq("user_id", userId)
      .single();

    if (!bookingRaw) {
      return NextResponse.json(
        { error: "Agendamento não encontrado" },
        { status: 404 },
      );
    }
    booking = bookingRaw as unknown as typeof booking;

    if (booking!.status !== "done") {
      return NextResponse.json(
        { error: "Serviço ainda não foi concluído" },
        { status: 400 },
      );
    }
  } else {
    // Auto-pick: primeiro booking done elegivel SEM foto.
    const { data: candidatesRaw } = await supabase
      .from("estetica_bookings")
      .select("id, status, service_id, scheduled_at, estetica_services(eligible_for_loyalty)")
      .eq("user_id", userId)
      .eq("status", "done")
      .order("scheduled_at", { ascending: false });

    type Candidate = {
      id: string;
      status: string;
      service_id: string;
      estetica_services: { eligible_for_loyalty: boolean } | null;
    };
    const candidates = (candidatesRaw ?? []) as unknown as Candidate[];
    const eligibleBookings = candidates.filter(
      (b) => b.estetica_services?.eligible_for_loyalty === true,
    );

    if (eligibleBookings.length === 0) {
      return NextResponse.json(
        {
          error: "no_eligible_booking",
          message:
            "Você ainda não tem agendamento concluído e elegível pra fidelidade. Finalize um serviço antes de enviar a foto.",
        },
        { status: 422 },
      );
    }

    // Excluir bookings que ja tem foto.
    const eligibleIds = eligibleBookings.map((b) => b.id);
    const { data: existingPhotos } = await supabase
      .from("estetica_loyalty_photos")
      .select("booking_id")
      .eq("user_id", userId)
      .in("booking_id", eligibleIds);
    const usedIds = new Set(
      (existingPhotos ?? []).map((p) => p.booking_id as string),
    );
    const candidate = eligibleBookings.find((b) => !usedIds.has(b.id));
    if (!candidate) {
      return NextResponse.json(
        {
          error: "no_eligible_booking",
          message:
            "Todos os seus agendamentos concluídos já têm foto. Finalize outro serviço pra enviar mais uma.",
        },
        { status: 422 },
      );
    }
    booking = {
      id: candidate.id,
      status: candidate.status,
      service_id: candidate.service_id,
    };
  }

  const bookingId = booking!.id;

  // 2. Verificar serviço é elegível pra fidelidade (redundante no auto-pick mas
  //    seguro pro fluxo explicito).
  const { data: serviceRaw } = await supabase
    .from("estetica_services")
    .select("eligible_for_loyalty")
    .eq("id", booking!.service_id)
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
