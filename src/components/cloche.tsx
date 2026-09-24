import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { IconBell } from "@tabler/icons-react";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/** La cloche : le nombre de notifications non lues, en badge. */
export async function Cloche({ userId }: { userId: number }) {
  const [total] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.lue, false)));

  return (
    <Link
      href="/notifications"
      aria-label={
        total.n > 0
          ? `Notifications : ${total.n} non lue${total.n > 1 ? "s" : ""}`
          : "Notifications"
      }
      className="relative flex items-center rounded-xl p-2 text-encre-doux transition hover:bg-vert-clair hover:text-vert-fonce"
    >
      <IconBell className="h-[21px] w-[21px]" stroke={1.7} />
      {total.n > 0 && (
        <span className="absolute -top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-rouge px-1 text-[11px] font-bold text-white">
          {total.n}
        </span>
      )}
    </Link>
  );
}
