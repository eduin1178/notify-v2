CREATE TABLE "conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"whatsapp_connection_id" text NOT NULL,
	"contact_id" text,
	"kapso_conversation_id" text,
	"phone_number" text,
	"notify_status" text DEFAULT 'abierta' NOT NULL,
	"assigned_user_id" text,
	"last_inbound_at" timestamp,
	"last_message_at" timestamp,
	"last_message_text" text,
	"last_message_type" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_kapso_conversation_id_unique" UNIQUE("kapso_conversation_id")
);
--> statement-breakpoint
CREATE TABLE "inbox_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"whatsapp_connection_id" text NOT NULL,
	"reopen_behavior" text DEFAULT 'reopen_keep_agent' NOT NULL,
	"send_read_receipts" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inbox_settings_connection_unique" UNIQUE("whatsapp_connection_id")
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_whatsapp_connection_id_whatsapp_connection_id_fk" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_settings" ADD CONSTRAINT "inbox_settings_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_settings" ADD CONSTRAINT "inbox_settings_whatsapp_connection_id_whatsapp_connection_id_fk" FOREIGN KEY ("whatsapp_connection_id") REFERENCES "public"."whatsapp_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_org_conn_last_msg_idx" ON "conversation" USING btree ("organization_id","whatsapp_connection_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversation_org_assignee_idx" ON "conversation" USING btree ("organization_id","assigned_user_id");--> statement-breakpoint
CREATE INDEX "conversation_org_status_idx" ON "conversation" USING btree ("organization_id","notify_status");