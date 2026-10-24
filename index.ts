// Edge Function "send-push" : envoie une notification Web Push aux telephones abonnes.
// Appelee par le trigger SQL notifications_push() a chaque nouvelle ligne de "notifications".
//
// Secrets a definir (Edge Functions > Secrets) :
//   VAPID_PUBLIC_KEY   = la meme cle publique que dans js/config.js
//   VAPID_PRIVATE_KEY  = la cle privee associee (JAMAIS dans GitHub)
//   VAPID_SUBJECT      = mailto:votre-adresse@exemple.com
//   PUSH_SECRET        = un mot de passe long, identique a 'push_secret' dans le Vault SQL
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement.
//
// Deploiement : desactiver "Verify JWT" (l'appel est protege par PUSH_SECRET).

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const { record } = await req.json();
  if (!record) return new Response("no record", { status: 400 });

  // Destinataires : si la notification vise des personnes precises, on filtre ; sinon tous les abonnes.
  // NOTE : adaptez cette partie si votre table "notifications" gere les destinataires autrement
  // (ex. colonne "audience" = 'staff'). Envoyez-moi le BLOC 4 du diagnostic et je l'ajuste.
  let q = db.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
  if (record.user_id) q = q.eq("user_id", record.user_id);
  const { data: subs, error } = await q;
  if (error) return new Response(error.message, { status: 500 });

  const payload = JSON.stringify({
    title: record.title,
    body: record.body ?? "",
    url: record.url ?? "index.html",
    kind: record.kind ?? "bsl",
  });

  let sent = 0, removed = 0;
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 86400, urgency: "high" },
      );
      sent++;
    } catch (e: any) {
      // 404 / 410 : abonnement expire ou desinstalle -> on le supprime
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        removed++;
      } else {
        console.error("push failed", e?.statusCode, e?.body);
      }
    }
  }));

  return Response.json({ sent, removed, total: subs?.length ?? 0 });
});
                                      
