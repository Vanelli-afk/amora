"use server";

import { z } from "zod";
import { searchEverything } from "@/data/search";
import { defineAction } from "@/lib/action";

export const search = defineAction("search", z.object({ query: z.string().trim().min(2).max(120) }), async ({ query }, { userId }) => {
  return searchEverything(userId, query);
}, { limit: { max: 60, windowSeconds: 60 } });
