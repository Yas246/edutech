"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { exiger } from "@/lib/auth";

export async function marquerLue(donnees: FormData) {
  const utilisateur = await exiger();
  const id = Number(donnees.get("notificationId"));
  await db
    .update(notifications)
    .set({ lue: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, utilisateur.id)));
  revalidatePath("/notifications");
}

export async function toutMarquer() {
  const utilisateur = await exiger();
  await db
    .update(notifications)
    .set({ lue: true })
    .where(eq(notifications.userId, utilisateur.id));
  revalidatePath("/notifications");
}
