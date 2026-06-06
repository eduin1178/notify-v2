CREATE TABLE "inbox_message_usage" (
	"wamid" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"direction" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_message_usage" ADD CONSTRAINT "inbox_message_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;