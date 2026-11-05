import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Throw from anywhere in a request; `handle` turns it into a JSON response. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what, "not_found");
export const forbidden = (why = "Forbidden") => new HttpError(403, why, "forbidden");
export const unauthorized = () => new HttpError(401, "Sign in required", "unauthorized");

/** Wrap a route handler: maps HttpError / ZodError / unknown errors to consistent JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid request", code: "validation", issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong", code: "internal" }, { status: 500 });
    }
  };
}
