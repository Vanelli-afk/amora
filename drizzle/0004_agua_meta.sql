ALTER TABLE "day_entries" ADD COLUMN "water_ml" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "water_goal" integer DEFAULT 2000 NOT NULL;