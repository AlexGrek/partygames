import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("crocodile", "routes/crocodile.tsx"),
  route("slopmachine", "routes/slopmachine.tsx"),
  route("db", "routes/db.tsx"),
  route("files", "routes/files.tsx"),
] satisfies RouteConfig;
