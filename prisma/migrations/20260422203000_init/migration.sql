CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "password_salt" TEXT NOT NULL,
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_chapters" (
  "user_id" INTEGER NOT NULL,
  "chapter_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_chapters_pkey" PRIMARY KEY ("user_id", "chapter_key")
);

CREATE TABLE "atas" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "sociedade" TEXT NOT NULL,
  "output_name" TEXT NOT NULL,
  "payload_json" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "atas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ata_attachments" (
  "id" SERIAL NOT NULL,
  "ata_id" INTEGER NOT NULL,
  "client_id" TEXT NOT NULL,
  "legenda" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "content" BYTEA,
  "position" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ata_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");
CREATE INDEX "idx_sessions_token_hash" ON "sessions"("token_hash");
CREATE INDEX "idx_user_chapters_chapter" ON "user_chapters"("chapter_key");
CREATE INDEX "idx_atas_sociedade_updated" ON "atas"("sociedade", "updated_at");
CREATE INDEX "idx_atas_user_updated" ON "atas"("user_id", "updated_at");
CREATE INDEX "idx_attachments_ata_position" ON "ata_attachments"("ata_id", "position");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_chapters"
  ADD CONSTRAINT "user_chapters_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "atas"
  ADD CONSTRAINT "atas_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ata_attachments"
  ADD CONSTRAINT "ata_attachments_ata_id_fkey"
  FOREIGN KEY ("ata_id") REFERENCES "atas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
