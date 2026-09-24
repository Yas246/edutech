"use server";

import { redirect } from "next/navigation";
import { deconnecter } from "@/lib/auth";

export async function seDeconnecter() {
  await deconnecter();
  redirect("/");
}
