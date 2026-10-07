ALTER TYPE "public"."live_session_status" ADD VALUE 'chat';--> statement-breakpoint
CREATE TABLE "support_telegram_messages" (
	"telegram_message_id" bigint PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "support_wait_seconds" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "live_sessions" ADD COLUMN "screen_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "support_telegram_messages" ADD CONSTRAINT "support_telegram_messages_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_telegram_messages_session_idx" ON "support_telegram_messages" USING btree ("session_id");