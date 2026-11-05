import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PocChat } from "./poc-chat";

/** Dev-only Nexconn PoC. Open one tab per persona: /dev/chat?as=customer|maya|arjun|ravi */
export default function Page({ searchParams }: PageProps<"/dev/chat">) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      {searchParams.then((sp) => (
        <PocChat as={(typeof sp.as === "string" ? sp.as : "customer") as "customer"} />
      ))}
    </Suspense>
  );
}
