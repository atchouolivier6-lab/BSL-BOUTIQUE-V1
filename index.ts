// Edge Function "send-push" : envoie une notification Web Push aux telephones abonnes.
// Deploiement : nom EXACT "send-push", option "Verify JWT" DESACTIVEE.
// Secrets requis : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SECRET

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  // Ouvrir l'adresse dans un navigateur : repond "en ligne" si la fonction est bien deployee.
  if (req.method === "GET") return new Response("send-push : en ligne", { status: 200 });

  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const { record } = await req.json();
  if (!record) return new Response("no record", { status: 400 });

  // Destinataires : un utilisateur precis si la notification en designe un, sinon tous les abonnes.
  let q = db.from("push_subscriptions").select("endpoint,p256dh,auth");
  if (record.user_id) q = q.eq("user_id", record.user_id);
  const { data: subs, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({
    title: record.title,
    body: record.body ?? "",
    url: record.url ?? "index.html",
    kind: record.kind ?? "bsl",
  });

  let sent = 0, removed = 0, failed = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 86400, urgency: "high" },
      );
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else {
        failed++;
        console.error("push failed", e?.statusCode, e?.body);
      }
    }
  }));

  return Response.json({ sent, removed, failed, total: subs?.length ?? 0 });
});
