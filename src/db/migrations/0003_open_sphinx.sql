CREATE TABLE "organization_email_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 587 NOT NULL,
	"secure" boolean DEFAULT false NOT NULL,
	"username" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"from_name" text,
	"from_email" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recipient_name" text,
	"recipient_phone" text,
	"recipient_email" text,
	"source_type" text,
	"source_id" text,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_documents_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "organization_email_settings" ADD CONSTRAINT "organization_email_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_documents" ADD CONSTRAINT "shared_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shared_documents_organization_id_idx" ON "shared_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shared_documents_source_idx" ON "shared_documents" USING btree ("organization_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "shared_documents_expires_at_idx" ON "shared_documents" USING btree ("expires_at");