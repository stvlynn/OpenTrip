-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "agent_panel_collapsed" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "trip_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "actor_user_id" TEXT,
    "source" TEXT NOT NULL DEFAULT 'chat',
    "trip_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_suggestions" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "message_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "suggestion_text" TEXT NOT NULL,
    "patch" JSONB NOT NULL,
    "trip_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "applied_by" TEXT,
    "applied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_suggestion_dismissals" (
    "suggestion_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dismissed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_suggestion_dismissals_pkey" PRIMARY KEY ("suggestion_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_messages_seq_unique" ON "agent_messages"("seq");

-- CreateIndex
CREATE INDEX "agent_messages_trip_seq_idx" ON "agent_messages"("trip_id", "seq");

-- CreateIndex
CREATE INDEX "agent_suggestions_trip_status_idx" ON "agent_suggestions"("trip_id", "status");

-- AddForeignKey
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_suggestions" ADD CONSTRAINT "agent_suggestions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_suggestion_dismissals" ADD CONSTRAINT "agent_suggestion_dismissals_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "agent_suggestions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
