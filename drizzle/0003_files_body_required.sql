-- Linhas ainda sem conteúdo apontam para arquivos em disco que deixam de ser lidos.
DELETE FROM "files" WHERE "body" IS NULL;--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_storage_key_unique";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "files" DROP COLUMN "storage_key";