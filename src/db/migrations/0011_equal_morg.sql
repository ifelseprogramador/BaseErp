CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"ui_mode" text DEFAULT 'formal' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
