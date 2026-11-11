import { sql } from "drizzle-orm";
import {
  type AnyPgColumn, bigint, boolean, customType, date, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text,
  timestamp, uniqueIndex, uuid, varchar,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date());
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/* ---------- Better Auth ---------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  termsAcceptedAt: ts("terms_accepted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: ts("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: ts("locked_until"),
}, (t) => [index("two_factor_user_idx").on(t.userId), index("two_factor_secret_idx").on(t.secret)]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  // Better Auth grava em milissegundos, que não cabem em integer.
  lastRequest: bigint("last_request", { mode: "number" }),
});

/* ---------- Diário ---------- */

export const colorEnum = pgEnum("palette_color", ["sky", "lav", "peach", "sage", "rose", "sand"]);
export const shelfEnum = pgEnum("book_shelf", ["reading", "next", "finished"]);
export const noteKindEnum = pgEnum("note_kind", ["postit", "note"]);
export const noteColorEnum = pgEnum("note_color", ["y", "p", "m", "b", "l", "paper"]);
export const stickerEnum = pgEnum("day_sticker", ["star", "rainbow", "moon"]);
export const themeEnum = pgEnum("theme", ["light", "dark", "auto"]);
export const reminderSourceEnum = pgEnum("reminder_source", ["event", "task", "standalone", "bill"]);
export const fileKindEnum = pgEnum("file_kind", ["cover", "avatar", "pet"]);

export type Recurrence = { freq: "daily" | "weekly" | "monthly" | "yearly"; until?: string };

const owner = () => text("user_id").notNull().references(() => user.id, { onDelete: "cascade" });

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  theme: themeEnum("theme").notNull().default("auto"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  stepGoal: integer("step_goal").notNull().default(8000),
  waterGoal: integer("water_goal").notNull().default(2000),
  waterStepMl: integer("water_step_ml").notNull().default(250),
  sleepGoalMinutes: integer("sleep_goal_minutes").notNull().default(480),
  pagesGoal: integer("pages_goal").notNull().default(20),
  booksGoal: integer("books_goal").notNull().default(12),
  budgetAlertPct: integer("budget_alert_pct").notNull().default(85),
  savingsGoalPct: integer("savings_goal_pct").notNull().default(40),
  notifyEvents: boolean("notify_events").notNull().default(true),
  notifyMorning: boolean("notify_morning").notNull().default(false),
  morningTime: varchar("morning_time", { length: 5 }).notNull().default("07:30"),
  nextMorningAt: ts("next_morning_at"),
  notifyEvening: boolean("notify_evening").notNull().default(false),
  eveningTime: varchar("evening_time", { length: 5 }).notNull().default("21:00"),
  nextEveningAt: ts("next_evening_at"),
  updatedAt: updatedAt(),
});

export const dayEntries = pgTable("day_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
  mood: smallint("mood"),
  waterMl: integer("water_ml").notNull().default(0),  steps: integer("steps"),
  sleepMinutes: integer("sleep_minutes"),
  sticker: stickerEnum("sticker"),
  gratitudeEnc: text("gratitude_enc"),
  reflectionEnc: text("reflection_enc"),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("day_entries_user_date_uq").on(t.userId, t.date)]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
  startTime: varchar("start_time", { length: 5 }),
  endTime: varchar("end_time", { length: 5 }),
  color: colorEnum("color").notNull().default("sky"),
  recurrence: jsonb("recurrence").$type<Recurrence>(),
  reminderMinutes: integer("reminder_minutes"),
  // Compromisso de um pet: aparece no calendário como qualquer outro e some junto com o pet.
  petId: uuid("pet_id").references((): AnyPgColumn => pets.id, { onDelete: "cascade" }),
  titleEnc: text("title_enc").notNull(),
  locationEnc: text("location_enc"),
  notesEnc: text("notes_enc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("events_user_date_idx").on(t.userId, t.date)]);

// Uma ocorrência removida da série. Editar "só este" pula o dia e cria um evento avulso.
export const eventExceptions = pgTable("event_exceptions", {
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.date] }), index("event_exceptions_user_idx").on(t.userId)]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  date: date("date", { mode: "string" }),
  dueTime: varchar("due_time", { length: 5 }),
  done: boolean("done").notNull().default(false),
  doneAt: ts("done_at"),
  highlight: boolean("highlight").notNull().default(false),
  position: doublePrecision("position").notNull().default(0),
  titleEnc: text("title_enc").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("tasks_user_date_idx").on(t.userId, t.date), index("tasks_user_done_idx").on(t.userId, t.done)]);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  kind: noteKindEnum("kind").notNull().default("postit"),
  color: noteColorEnum("color").notNull().default("y"),
  pinned: boolean("pinned").notNull().default(false),
  date: date("date", { mode: "string" }),
  titleEnc: text("title_enc"),
  // post-it: texto puro. nota: JSON do editor.
  bodyEnc: text("body_enc").notNull(),
  // As etiquetas ficam num único campo cifrado; o filtro acontece depois de decifrar.
  tagsEnc: text("tags_enc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("notes_user_date_idx").on(t.userId, t.date), index("notes_user_updated_idx").on(t.userId, t.updatedAt)]);

export const habits = pgTable("habits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  titleEnc: text("title_enc").notNull(),
  // Dias da semana em que o hábito vale (bit 0 = domingo). 127 = todos, como sempre foi.
  weekdays: integer("weekdays").notNull().default(127),
  archivedAt: ts("archived_at"),
  createdAt: createdAt(),
}, (t) => [index("habits_user_idx").on(t.userId)]);

export const habitLogs = pgTable("habit_logs", {
  habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
}, (t) => [primaryKey({ columns: [t.habitId, t.date] }), index("habit_logs_user_date_idx").on(t.userId, t.date)]);

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  kind: fileKindEnum("kind").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  body: bytea("body").notNull(),
  createdAt: createdAt(),
}, (t) => [index("files_user_idx").on(t.userId)]);

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  title: text("title").notNull(),
  author: text("author"),
  pages: integer("pages"),
  currentPage: integer("current_page").notNull().default(0),
  shelf: shelfEnum("shelf").notNull().default("next"),
  startedOn: date("started_on", { mode: "string" }),
  finishedOn: date("finished_on", { mode: "string" }),
  rating: smallint("rating"),
  coverFileId: uuid("cover_file_id").references(() => files.id, { onDelete: "set null" }),
  coverStyle: smallint("cover_style").notNull().default(1),
  reviewEnc: text("review_enc"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("books_user_shelf_idx").on(t.userId, t.shelf)]);

export const bookQuotes = pgTable("book_quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  userId: owner(),
  textEnc: text("text_enc").notNull(),
  page: integer("page"),
  createdAt: createdAt(),
}, (t) => [index("book_quotes_book_idx").on(t.bookId), index("book_quotes_user_idx").on(t.userId)]);

export const readingLogs = pgTable("reading_logs", {
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
  pages: integer("pages").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.bookId, t.date] }), index("reading_logs_user_date_idx").on(t.userId, t.date)]);

export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  source: reminderSourceEnum("source").notNull(),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  billId: uuid("bill_id").references((): AnyPgColumn => finBills.id, { onDelete: "cascade" }),
  // Dia e hora no fuso do usuário, com a antecedência: permitem recalcular fire_at se o fuso mudar.
  date: date("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 5 }).notNull(),
  leadMinutes: integer("lead_minutes").notNull().default(0),
  fireAt: ts("fire_at").notNull(),
  sentAt: ts("sent_at"),
  titleEnc: text("title_enc"),
  createdAt: createdAt(),
}, (t) => [
  index("reminders_due_idx").on(t.fireAt).where(sql`${t.sentAt} IS NULL`),
  index("reminders_user_date_idx").on(t.userId, t.date),
  index("reminders_event_idx").on(t.eventId),
  index("reminders_task_idx").on(t.taskId),
]);

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: createdAt(),
}, (t) => [index("push_user_idx").on(t.userId)]);

/* ---------- Finanças ---------- */
// Valores em centavos e datas em claro, para somar e agrupar no banco; todo texto vai cifrado.

export const finTypeEnum = pgEnum("fin_type", ["expense", "income"]);
export const finAccountKindEnum = pgEnum("fin_account_kind", ["checking", "savings", "wallet", "card"]);
export const payMethodEnum = pgEnum("fin_pay_method", ["pix", "debit", "credit", "boleto", "transfer", "cash", "auto_debit"]);
export const finRecurringKindEnum = pgEnum("fin_recurring_kind", ["fixed", "tuition", "subscription"]);

export const finAccounts = pgTable("fin_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  nameEnc: text("name_enc").notNull(),
  kind: finAccountKindEnum("kind").notNull().default("checking"),
  openingCents: integer("opening_cents").notNull().default(0),
  archivedAt: ts("archived_at"),
  createdAt: createdAt(),
}, (t) => [index("fin_accounts_user_idx").on(t.userId)]);

export const finCategories = pgTable("fin_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  parentId: uuid("parent_id").references((): AnyPgColumn => finCategories.id, { onDelete: "cascade" }),
  type: finTypeEnum("type").notNull().default("expense"),
  nameEnc: text("name_enc").notNull(),
  color: colorEnum("color").notNull().default("sky"),
  icon: varchar("icon", { length: 16 }).notNull().default("grid"),
  position: integer("position").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("fin_categories_user_idx").on(t.userId), index("fin_categories_parent_idx").on(t.parentId)]);

export const finTransactions = pgTable("fin_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  type: finTypeEnum("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  accountId: uuid("account_id").notNull().references(() => finAccounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => finCategories.id, { onDelete: "set null" }),
  payMethod: payMethodEnum("pay_method").notNull().default("pix"),
  descriptionEnc: text("description_enc").notNull(),
  noteEnc: text("note_enc"),
  recurringId: uuid("recurring_id").references((): AnyPgColumn => finRecurring.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("fin_tx_user_date_idx").on(t.userId, t.date),
  index("fin_tx_account_idx").on(t.accountId),
  index("fin_tx_category_idx").on(t.categoryId),
]);

export const finBudgets = pgTable("fin_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  categoryId: uuid("category_id").notNull().references(() => finCategories.id, { onDelete: "cascade" }),
  limitCents: integer("limit_cents").notNull(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("fin_budgets_user_category_uq").on(t.userId, t.categoryId)]);

export const finRecurring = pgTable("fin_recurring", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  type: finTypeEnum("type").notNull().default("expense"),
  kind: finRecurringKindEnum("kind").notNull().default("fixed"),
  nameEnc: text("name_enc").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dayOfMonth: smallint("day_of_month").notNull(),
  categoryId: uuid("category_id").references(() => finCategories.id, { onDelete: "set null" }),
  accountId: uuid("account_id").references(() => finAccounts.id, { onDelete: "set null" }),
  payMethod: payMethodEnum("pay_method").notNull().default("auto_debit"),
  startsOn: date("starts_on", { mode: "string" }).notNull(),
  endsOn: date("ends_on", { mode: "string" }),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("fin_recurring_user_idx").on(t.userId)]);

export const finBills = pgTable("fin_bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  // Nulo nas contas geradas por uma recorrente: o nome vem dela.
  nameEnc: text("name_enc"),
  categoryId: uuid("category_id").references(() => finCategories.id, { onDelete: "set null" }),
  recurringId: uuid("recurring_id").references(() => finRecurring.id, { onDelete: "cascade" }),
  paidAt: ts("paid_at"),
  paidOn: date("paid_on", { mode: "string" }),
  transactionId: uuid("transaction_id").references(() => finTransactions.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [
  index("fin_bills_user_due_idx").on(t.userId, t.dueDate),
  uniqueIndex("fin_bills_recurring_due_uq").on(t.recurringId, t.dueDate),
]);

/* ---------- Pets ---------- */

export const petSpeciesEnum = pgEnum("pet_species", ["dog", "cat", "rabbit", "other"]);
export const petExpenseCategoryEnum = pgEnum("pet_expense_category", ["food", "vet", "hygiene", "medicine", "accessories", "other"]);

export const pets = pgTable("pets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  nameEnc: text("name_enc").notNull(),
  species: petSpeciesEnum("species").notNull().default("dog"),
  color: colorEnum("color").notNull().default("peach"),
  breedEnc: text("breed_enc"),
  birthDate: date("birth_date", { mode: "string" }),
  weightGrams: integer("weight_grams"),
  neuteredOn: date("neutered_on", { mode: "string" }),
  microchipEnc: text("microchip_enc"),
  allergiesEnc: text("allergies_enc"),
  vetEnc: text("vet_enc"),
  notesEnc: text("notes_enc"),
  avatarFileId: uuid("avatar_file_id").references(() => files.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index("pets_user_idx").on(t.userId)]);

export const petVaccines = pgTable("pet_vaccines", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  petId: uuid("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  nameEnc: text("name_enc").notNull(),
  doneOn: date("done_on", { mode: "string" }),
  nextOn: date("next_on", { mode: "string" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("pet_vaccines_pet_idx").on(t.petId), index("pet_vaccines_user_next_idx").on(t.userId, t.nextOn)]);

export const petMedicines = pgTable("pet_medicines", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  petId: uuid("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  nameEnc: text("name_enc").notNull(),
  intervalDays: integer("interval_days"),
  lastOn: date("last_on", { mode: "string" }),
  nextOn: date("next_on", { mode: "string" }),
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
  createdAt: createdAt(),
}, (t) => [index("pet_medicines_pet_idx").on(t.petId), index("pet_medicines_user_next_idx").on(t.userId, t.nextOn)]);

export const petVisits = pgTable("pet_visits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  petId: uuid("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  titleEnc: text("title_enc").notNull(),
  noteEnc: text("note_enc"),
}, (t) => [index("pet_visits_pet_idx").on(t.petId)]);

export const petRoutines = pgTable("pet_routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  petId: uuid("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  nameEnc: text("name_enc").notNull(),
  icon: varchar("icon", { length: 16 }).notNull().default("paw"),
  times: jsonb("times").$type<string[]>().notNull().default([]),
  weekdays: integer("weekdays").notNull().default(127),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => [index("pet_routines_pet_idx").on(t.petId), index("pet_routines_user_idx").on(t.userId)]);

export const petRoutineLogs = pgTable("pet_routine_logs", {
  routineId: uuid("routine_id").notNull().references(() => petRoutines.id, { onDelete: "cascade" }),
  userId: owner(),
  date: date("date", { mode: "string" }).notNull(),
  time: varchar("time", { length: 5 }).notNull().default(""),
}, (t) => [primaryKey({ columns: [t.routineId, t.date, t.time] }), index("pet_routine_logs_user_date_idx").on(t.userId, t.date)]);

export const petExpenses = pgTable("pet_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: owner(),
  petId: uuid("pet_id").notNull().references(() => pets.id, { onDelete: "cascade" }),
  category: petExpenseCategoryEnum("category").notNull().default("other"),
  amountCents: integer("amount_cents").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  titleEnc: text("title_enc").notNull(),
  createdAt: createdAt(),
}, (t) => [index("pet_expenses_user_date_idx").on(t.userId, t.date), index("pet_expenses_pet_idx").on(t.petId)]);

export const actionLimits = pgTable("action_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: ts("window_start").notNull().defaultNow(),
});
