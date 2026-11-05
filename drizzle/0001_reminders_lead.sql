ALTER TABLE "reminders" ALTER COLUMN "date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "lead_minutes" integer DEFAULT 0 NOT NULL;