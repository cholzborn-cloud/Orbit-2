import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { ORBIS } from "@/components/chat-avatar";
import { bots } from "./schema";

export const insertBotSchema = createInsertSchema(bots, {
  name: (s) => s.trim().min(1, "Gib deinem Orbi einen Namen").max(40),
  job: (s) => s.trim().min(1, "Gib deinem Orbi eine Aufgabe").max(60),
  avatar: z.enum(ORBIS),
  instructions: (s) => s.trim().max(1000),
});

// Felder, die der Nutzer im Dialog ausfüllt. userId/thirdPartyId setzt der Server.
export const botFormSchema = insertBotSchema.pick({
  name: true,
  avatar: true,
  job: true,
  instructions: true,
});

export type BotFormValues = z.infer<typeof botFormSchema>;
