import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";

/** La cloche : le nombre de notifications non lues, en badge. */
export async function Cloche({ userId }: { userId: number }) {
  const [total] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.lue, false)));

  return (
    <li>
      <Link
        href="/notifications"
        className="relative flex items-center rounded-lg px-3 py-2 font-medium text-vert-fonce hover:bg-vert-clair"
        aria-label={
          total.n > 0
            ? `Notifications : ${total.n} non lue${total.n > 1 ? "s" : ""}`
            : "Notifications"
        }
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {total.n > 0 && (
          <span className="absolute -top-0.5 right-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-rouge px-1 text-[11px] font-bold text-white">
            {total.n}
          </span>
        )}
      </Link>
    </li>
  );
}
