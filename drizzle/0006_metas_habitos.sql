ALTER TABLE "habits" ADD COLUMN "weekdays" integer DEFAULT 127 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "water_step_ml" integer DEFAULT 250 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "sleep_goal_minutes" integer DEFAULT 480 NOT NULL;