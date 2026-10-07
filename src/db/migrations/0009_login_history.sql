CREATE TABLE "login_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text,
	"organization_name" text,
	"ip" text,
	"city" text,
	"region" text,
	"country" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_events_created_at_idx" ON "login_events" USING btree ("created_at");