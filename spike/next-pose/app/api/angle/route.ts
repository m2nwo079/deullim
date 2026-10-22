import { angleBetween } from "../../../lib/angle";

// GET /api/angle?ax=1&ay=0&bx=0&by=1 -> {"angle": 90}
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const values = ["ax", "ay", "bx", "by"].map((k) => Number(params.get(k)));
  if (values.some((v) => !Number.isFinite(v))) {
    return Response.json({ error: "ax, ay, bx, by must be finite numbers" }, { status: 400 });
  }
  const [ax, ay, bx, by] = values;
  return Response.json({ angle: angleBetween([ax, ay], [bx, by]) });
}
