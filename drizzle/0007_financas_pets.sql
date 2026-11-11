CREATE TYPE "public"."fin_account_kind" AS ENUM('checking', 'savings', 'wallet', 'card');--> statement-breakpoint
CREATE TYPE "public"."fin_recurring_kind" AS ENUM('fixed', 'tuition', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."fin_type" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."fin_pay_method" AS ENUM('pix', 'debit', 'credit', 'boleto', 'transfer', 'cash', 'auto_debit');--> statement-breakpoint
CREATE TYPE "public"."pet_expense_category" AS ENUM('food', 'vet', 'hygiene', 'medicine', 'accessories', 'other');--> statement-breakpoint
CREATE TYPE "public"."pet_species" AS ENUM('dog', 'cat', 'rabbit', 'other');--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'pet';--> statement-breakpoint
ALTER TYPE "public"."reminder_source" ADD VALUE 'bill';--> statement-breakpoint
CREATE TABLE "fin_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name_enc" text NOT NULL,
	"kind" "fin_account_kind" DEFAULT 'checking' NOT NULL,
	"opening_cents" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"name_enc" text,
	"category_id" uuid,
	"recurring_id" uuid,
	"paid_at" timestamp with time zone,
	"paid_on" date,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"limit_cents" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"type" "fin_type" DEFAULT 'expense' NOT NULL,
	"name_enc" text NOT NULL,
	"color" "palette_color" DEFAULT 'sky' NOT NULL,
	"icon" varchar(16) DEFAULT 'grid' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "fin_type" DEFAULT 'expense' NOT NULL,
	"kind" "fin_recurring_kind" DEFAULT 'fixed' NOT NULL,
	"name_enc" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"day_of_month" smallint NOT NULL,
	"category_id" uuid,
	"account_id" uuid,
	"pay_method" "fin_pay_method" DEFAULT 'auto_debit' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "fin_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" date NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"pay_method" "fin_pay_method" DEFAULT 'pix' NOT NULL,
	"description_enc" text NOT NULL,
	"note_enc" text,
	"recurring_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"category" "pet_expense_category" DEFAULT 'other' NOT NULL,
	"amount_cents" integer NOT NULL,
	"date" date NOT NULL,
	"title_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_medicines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"interval_days" integer,
	"last_on" date,
	"next_on" date,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_routine_logs" (
	"routine_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"time" varchar(5) DEFAULT '' NOT NULL,
	CONSTRAINT "pet_routine_logs_routine_id_date_time_pk" PRIMARY KEY("routine_id","date","time")
);
--> statement-breakpoint
CREATE TABLE "pet_routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"icon" varchar(16) DEFAULT 'paw' NOT NULL,
	"times" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weekdays" integer DEFAULT 127 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_vaccines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"name_enc" text NOT NULL,
	"done_on" date,
	"next_on" date,
	"event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pet_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"pet_id" uuid NOT NULL,
	"date" date NOT NULL,
	"title_enc" text NOT NULL,
	"note_enc" text
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name_enc" text NOT NULL,
	"species" "pet_species" DEFAULT 'dog' NOT NULL,
	"color" "palette_color" DEFAULT 'peach' NOT NULL,
	"breed_enc" text,
	"birth_date" date,
	"weight_grams" integer,
	"neutered_on" date,
	"microchip_enc" text,
	"allergies_enc" text,
	"vet_enc" text,
	"notes_enc" text,
	"avatar_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "pet_id" uuid;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "bill_id" uuid;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "budget_alert_pct" integer DEFAULT 85 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "savings_goal_pct" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "fin_accounts" ADD CONSTRAINT "fin_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_bills" ADD CONSTRAINT "fin_bills_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_bills" ADD CONSTRAINT "fin_bills_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_bills" ADD CONSTRAINT "fin_bills_recurring_id_fin_recurring_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."fin_recurring"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_bills" ADD CONSTRAINT "fin_bills_transaction_id_fin_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."fin_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_budgets" ADD CONSTRAINT "fin_budgets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_budgets" ADD CONSTRAINT "fin_budgets_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_categories" ADD CONSTRAINT "fin_categories_parent_id_fin_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."fin_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recurring" ADD CONSTRAINT "fin_recurring_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recurring" ADD CONSTRAINT "fin_recurring_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_recurring" ADD CONSTRAINT "fin_recurring_account_id_fin_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."fin_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_account_id_fin_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."fin_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_category_id_fin_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."fin_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_transactions" ADD CONSTRAINT "fin_transactions_recurring_id_fin_recurring_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "public"."fin_recurring"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_expenses" ADD CONSTRAINT "pet_expenses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_expenses" ADD CONSTRAINT "pet_expenses_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_medicines" ADD CONSTRAINT "pet_medicines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_medicines" ADD CONSTRAINT "pet_medicines_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_medicines" ADD CONSTRAINT "pet_medicines_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_routine_logs" ADD CONSTRAINT "pet_routine_logs_routine_id_pet_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."pet_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_routine_logs" ADD CONSTRAINT "pet_routine_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_routines" ADD CONSTRAINT "pet_routines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_routines" ADD CONSTRAINT "pet_routines_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_vaccines" ADD CONSTRAINT "pet_vaccines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_vaccines" ADD CONSTRAINT "pet_vaccines_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_vaccines" ADD CONSTRAINT "pet_vaccines_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_visits" ADD CONSTRAINT "pet_visits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pet_visits" ADD CONSTRAINT "pet_visits_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_avatar_file_id_files_id_fk" FOREIGN KEY ("avatar_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fin_accounts_user_idx" ON "fin_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fin_bills_user_due_idx" ON "fin_bills" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_bills_recurring_due_uq" ON "fin_bills" USING btree ("recurring_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_budgets_user_category_uq" ON "fin_budgets" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "fin_categories_user_idx" ON "fin_categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fin_categories_parent_idx" ON "fin_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "fin_recurring_user_idx" ON "fin_recurring" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "fin_tx_user_date_idx" ON "fin_transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "fin_tx_account_idx" ON "fin_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "fin_tx_category_idx" ON "fin_transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "pet_expenses_user_date_idx" ON "pet_expenses" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pet_expenses_pet_idx" ON "pet_expenses" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_medicines_pet_idx" ON "pet_medicines" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_medicines_user_next_idx" ON "pet_medicines" USING btree ("user_id","next_on");--> statement-breakpoint
CREATE INDEX "pet_routine_logs_user_date_idx" ON "pet_routine_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "pet_routines_pet_idx" ON "pet_routines" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_routines_user_idx" ON "pet_routines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pet_vaccines_pet_idx" ON "pet_vaccines" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pet_vaccines_user_next_idx" ON "pet_vaccines" USING btree ("user_id","next_on");--> statement-breakpoint
CREATE INDEX "pet_visits_pet_idx" ON "pet_visits" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "pets_user_idx" ON "pets" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_bill_id_fin_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."fin_bills"("id") ON DELETE cascade ON UPDATE no action;