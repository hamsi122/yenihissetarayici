import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ username: z.string().min(1).max(64), password: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyCredentials, getSession } = await import("./admin/admin.server");
    const ok = await verifyCredentials(data.username, data.password);
    if (!ok) return { ok: false as const };
    const session = await getSession();
    await session.update({ username: data.username.trim().toLowerCase() });
    return { ok: true as const, username: data.username.trim().toLowerCase() };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./admin/admin.server");
  const session = await getSession();
  await session.clear();
  return { ok: true as const };
});

export const adminMe = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("./admin/admin.server");
  const session = await getSession();
  return { username: session.data.username ?? null };
});

export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, getAdminStats, listAdmins } = await import("./admin/admin.server");
  const username = await requireAdmin();
  const [stats, admins] = await Promise.all([getAdminStats(), listAdmins()]);
  return { username, stats, admins };
});

export const adminCreate = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ username: z.string().min(3).max(64), password: z.string().min(8).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, createAdmin, listAdmins } = await import("./admin/admin.server");
    const actor = await requireAdmin();
    await createAdmin(data.username, data.password, actor);
    return { ok: true as const, admins: await listAdmins() };
  });

export const trackPageView = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        path: z.string().max(300),
        referrer: z.string().max(300).nullable().optional(),
        sessionId: z.string().max(100).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordPageView } = await import("./admin/admin.server");
    await recordPageView(data.path, data.referrer ?? null, data.sessionId ?? null);
    return { ok: true as const };
  });

export const trackError = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        message: z.string().max(1000),
        source: z.string().max(200).nullable().optional(),
        details: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { recordError } = await import("./admin/admin.server");
    await recordError(data.message, data.source ?? null, data.details ?? null);
    return { ok: true as const };
  });
